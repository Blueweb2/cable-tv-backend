const User = require("../models/user.model");
const Duty = require("../models/duty.model");
const Zone = require("../models/zone.model");
const Availability = require("../models/availability.model");

const CABLE_DEPARTMENTS = [
  "Fiber Optics & Splicing",
  "Field Linesmen & Wiring",
  "Network Operations (NOC)",
  "New Installations & STB Setup",
  "Customer Support & Dispatch",
  "Billing & Collection",
  "General Field Operations",
];

const CABLE_SPECIALIZATIONS = [
  "Fiber Technician",
  "Linesman",
  "Installation Technician",
  "NOC Specialist",
  "Support & Dispatch",
  "Billing Agent",
  "Field Technician",
];

/**
 * Maps jobType or category/service name to recommended department and specialization
 */
const mapJobTypeToTechnicianRole = (jobType = "", serviceName = "") => {
  const jt = (jobType || "").toUpperCase();
  const sn = (serviceName || "").toLowerCase();

  if (jt === "FIBER_SPLICING" || sn.includes("fiber") || sn.includes("splice") || sn.includes("otdr") || sn.includes("ftth")) {
    return {
      department: "Fiber Optics & Splicing",
      specialization: "Fiber Technician",
    };
  }

  if (jt === "LINE_REPAIR" || jt === "FIELD_PATROL" || jt === "SIGNAL_OPTIMIZATION" || sn.includes("line") || sn.includes("coax") || sn.includes("pole") || sn.includes("amplifier")) {
    return {
      department: "Field Linesmen & Wiring",
      specialization: "Linesman",
    };
  }

  if (jt === "NODE_MAINTENANCE" || sn.includes("noc") || sn.includes("server") || sn.includes("bandwidth")) {
    return {
      department: "Network Operations (NOC)",
      specialization: "NOC Specialist",
    };
  }

  if (jt === "NEW_INSTALLATION" || sn.includes("install") || sn.includes("stb") || sn.includes("router") || sn.includes("activation")) {
    return {
      department: "New Installations & STB Setup",
      specialization: "Installation Technician",
    };
  }

  if (jt === "PAYMENT_COLLECTION" || sn.includes("bill") || sn.includes("collect") || sn.includes("payment")) {
    return {
      department: "Billing & Collection",
      specialization: "Billing Agent",
    };
  }

  if (jt === "COMPLAINT_RESOLUTION" || sn.includes("support") || sn.includes("dispatch")) {
    return {
      department: "Customer Support & Dispatch",
      specialization: "Support & Dispatch",
    };
  }

  return {
    department: "General Field Operations",
    specialization: "Field Technician",
  };
};

/**
 * Normalizes a category or service name into a standard department key
 */
const mapCategoryToDepartment = (category = "", serviceName = "") => {
  return mapJobTypeToTechnicianRole("", `${category} ${serviceName}`).department;
};

/**
 * Get all available departments with staff counts and specialization breakdown
 */
const getDepartmentStats = async () => {
  const staff = await User.find({ role: "staff" })
    .select("department specialization name location phone isActive")
    .lean();

  const stats = CABLE_DEPARTMENTS.map((dept) => {
    const deptStaff = staff.filter(
      (s) => (s.department || "").toLowerCase() === dept.toLowerCase()
    );
    const activeDeptStaff = deptStaff.filter((s) => s.isActive);

    const specializations = {};
    deptStaff.forEach((s) => {
      const spec = s.specialization || "General";
      specializations[spec] = (specializations[spec] || 0) + 1;
    });

    return {
      department: dept,
      totalStaff: deptStaff.length,
      activeStaff: activeDeptStaff.length,
      specializations,
      staffMembers: deptStaff,
    };
  });

  return {
    departments: stats,
    specializations: CABLE_SPECIALIZATIONS,
  };
};

/**
 * Get staff recommendations matching specialization, department, active status, availability, and zone
 */
const getStaffRecommendations = async ({
  department = "",
  specialization = "",
  jobType = "",
  serviceName = "",
  zone = "",
  dutyDate = new Date(),
}) => {
  // 1. Infer target department & specialization if jobType is specified
  let targetDepartment = department && department !== "ALL" ? department : "";
  let targetSpecialization = specialization && specialization !== "ALL" ? specialization : "";

  if (jobType || serviceName) {
    const inferred = mapJobTypeToTechnicianRole(jobType, serviceName);
    if (!targetDepartment) targetDepartment = inferred.department;
    if (!targetSpecialization) targetSpecialization = inferred.specialization;
  }

  // 2. Fetch all active staff
  const staffList = await User.find({
    role: "staff",
    isActive: true,
  })
    .select("name email phone department specialization location employeeId")
    .lean();

  if (!staffList || staffList.length === 0) {
    return [];
  }

  // 3. Fetch availability and existing duty counts for the target date
  const targetDay = new Date(dutyDate);
  const startOfDay = new Date(targetDay.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDay.setHours(23, 59, 59, 999));

  const [availabilityRecords, activeDutiesOnDate] = await Promise.all([
    Availability.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    }).lean(),
    Duty.find({
      dutyDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
    }).select("staff").lean(),
  ]);

  const availabilityMap = new Map();
  availabilityRecords.forEach((a) => {
    availabilityMap.set(a.staff.toString(), a.status);
  });

  const dutyCountMap = new Map();
  activeDutiesOnDate.forEach((d) => {
    const sId = d.staff?.toString();
    if (sId) {
      dutyCountMap.set(sId, (dutyCountMap.get(sId) || 0) + 1);
    }
  });

  // 4. Calculate match score for each staff member
  const scoredStaff = staffList.map((member) => {
    const staffId = member._id.toString();
    let score = 0;
    const matchReasons = [];

    // Specialization Match (+50 points)
    if (targetSpecialization) {
      const sSpec = (member.specialization || "").toLowerCase();
      const tSpec = targetSpecialization.toLowerCase();
      if (sSpec === tSpec) {
        score += 50;
        matchReasons.push(`Exact Specialization Match (${member.specialization})`);
      } else if (sSpec.includes(tSpec) || tSpec.includes(sSpec)) {
        score += 30;
        matchReasons.push(`Related Specialization (${member.specialization})`);
      }
    }

    // Department Match (+30 points)
    if (targetDepartment) {
      const sDept = (member.department || "").toLowerCase();
      const tDept = targetDepartment.toLowerCase();
      if (sDept === tDept) {
        score += 30;
        matchReasons.push(`Department Match (${member.department})`);
      }
    }

    // Availability (+20 points if explicitly available, -40 if ON_LEAVE/UNAVAILABLE)
    const availStatus = availabilityMap.get(staffId) || "AVAILABLE";
    if (availStatus === "AVAILABLE") {
      score += 20;
    } else {
      score -= 40;
      matchReasons.push(`Status: ${availStatus}`);
    }

    // Existing Workload (-10 points per existing active duty on date)
    const activeDutiesCount = dutyCountMap.get(staffId) || 0;
    score -= activeDutiesCount * 10;

    return {
      ...member,
      id: member._id,
      matchScore: score,
      availabilityStatus: availStatus,
      activeDutiesCount,
      matchReasons,
    };
  });

  // 5. Filter out staff with heavily negative scores (on leave / unavailable) if there are available alternatives
  scoredStaff.sort((a, b) => b.matchScore - a.matchScore);

  return scoredStaff;
};

module.exports = {
  CABLE_DEPARTMENTS,
  CABLE_SPECIALIZATIONS,
  mapJobTypeToTechnicianRole,
  mapCategoryToDepartment,
  getDepartmentStats,
  getStaffRecommendations,
};
