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

/**
 * Normalizes a category or service name into a standard department key
 */
const mapCategoryToDepartment = (category = "", serviceName = "") => {
  const combined = `${category} ${serviceName}`.toLowerCase();

  if (combined.includes("fiber") || combined.includes("splice") || combined.includes("otdr") || combined.includes("ftth")) {
    return "Fiber Optics & Splicing";
  }
  if (combined.includes("line") || combined.includes("coax") || combined.includes("wire") || combined.includes("pole") || combined.includes("amplifier")) {
    return "Field Linesmen & Wiring";
  }
  if (combined.includes("network") || combined.includes("noc") || combined.includes("ip") || combined.includes("server") || combined.includes("bandwidth")) {
    return "Network Operations (NOC)";
  }
  if (combined.includes("install") || combined.includes("stb") || combined.includes("box") || combined.includes("router") || combined.includes("activation")) {
    return "New Installations & STB Setup";
  }
  if (combined.includes("support") || combined.includes("complaint") || combined.includes("dispatch") || combined.includes("helpdesk")) {
    return "Customer Support & Dispatch";
  }
  if (combined.includes("bill") || combined.includes("collect") || combined.includes("payment") || combined.includes("cash")) {
    return "Billing & Collection";
  }

  return "General Field Operations";
};

/**
 * Get all available departments with staff counts
 */
const getDepartmentStats = async () => {
  const staff = await User.find({ role: "staff", isActive: true }).select("department name location phone");
  const stats = CABLE_DEPARTMENTS.map((dept) => {
    const deptStaff = staff.filter((s) => (s.department || "").toLowerCase() === dept.toLowerCase());
    return {
      department: dept,
      totalStaff: deptStaff.length,
      staffMembers: deptStaff,
    };
  });

  return { departments: stats };
};

/**
 * Get staff recommendations for a zone or duty type
 */
const getStaffRecommendations = async ({ department = "", zone = "", dutyDate = new Date() }) => {
  const query = { role: "staff", isActive: true };
  if (department && department !== "ALL") {
    query.department = department;
  }

  const availableStaff = await User.find(query).select("name email phone department location");
  return availableStaff;
};

module.exports = {
  CABLE_DEPARTMENTS,
  mapCategoryToDepartment,
  getDepartmentStats,
  getStaffRecommendations,
};
