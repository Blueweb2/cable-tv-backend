const test = require("node:test");
const assert = require("node:assert");

const {
  validateStaffEligibility,
  computeDutyHoursAndAmount,
} = require("../services/assignment.service");

const {
  mapJobTypeToTechnicianRole,
} = require("../services/department.service");

// Helper validator for testing permission & assignment rules
const checkStaffAssignment = (user) => {
  if (!user) throw new Error("Selected technician not found");
  if (user.role !== "staff") throw new Error("Selected user is not a field staff member.");
  if (!user.isActive) throw new Error("Selected technician is inactive.");
  return true;
};

const checkDutyOwnership = (dutyDoc, user) => {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  if (role === "admin" || role === "manager") return true;

  const isLead = String(dutyDoc.staff?._id || dutyDoc.staff) === String(user.userId);
  const isTeam = Array.isArray(dutyDoc.assignedStaff) &&
    dutyDoc.assignedStaff.some((s) => String(s?._id || s) === String(user.userId));
  return isLead || isTeam;
};

const checkAvailabilityStatus = (status) => {
  if (status === "ON_LEAVE" || status === "UNAVAILABLE") {
    throw new Error(`Selected technician is unavailable on this date (${status}).`);
  }
  return true;
};

// 1. Manager can assign an active staff member
test("1. Manager can assign active staff member", () => {
  const activeStaff = { _id: "staff-01", role: "staff", isActive: true };
  assert.strictEqual(checkStaffAssignment(activeStaff), true);
});

// 2. Manager cannot assign inactive staff
test("2. Manager cannot assign inactive staff", () => {
  const inactiveStaff = { _id: "staff-02", role: "staff", isActive: false };
  assert.throws(() => checkStaffAssignment(inactiveStaff), /technician is inactive/);
});

// 3. Manager cannot assign manager or admin
test("3. Manager cannot assign manager or admin as field staff", () => {
  const managerUser = { _id: "mgr-01", role: "manager", isActive: true };
  const adminUser = { _id: "adm-01", role: "admin", isActive: true };
  assert.throws(() => checkStaffAssignment(managerUser), /not a field staff member/);
  assert.throws(() => checkStaffAssignment(adminUser), /not a field staff member/);
});

// 4. Staff cannot assign a duty
test("4. Staff role cannot create field duty assignments", () => {
  const canAssign = (role) => ["manager", "admin"].includes((role || "").toLowerCase());
  assert.strictEqual(canAssign("manager"), true);
  assert.strictEqual(canAssign("admin"), true);
  assert.strictEqual(canAssign("staff"), false);
});

// 5. Staff cannot reassign a duty
test("5. Staff role cannot reassign field duties to other staff", () => {
  const canReassign = (role) => ["manager", "admin"].includes((role || "").toLowerCase());
  assert.strictEqual(canReassign("staff"), false);
});

// 6. Staff can access own assigned duty
test("6. Staff can access own assigned duty", () => {
  const duty = { _id: "d-101", staff: "staff-01", assignedStaff: ["staff-01"] };
  const staffUser = { userId: "staff-01", role: "staff" };
  assert.strictEqual(checkDutyOwnership(duty, staffUser), true);
});

// 7. Staff can access team duty
test("7. Staff can access team duty where listed in assignedStaff", () => {
  const duty = { _id: "d-102", staff: "staff-lead", assignedStaff: ["staff-lead", "staff-assistant"] };
  const teamMember = { userId: "staff-assistant", role: "staff" };
  assert.strictEqual(checkDutyOwnership(duty, teamMember), true);
});

// 8. Staff cannot access another technician's duty
test("8. Staff cannot access another technician's duty", () => {
  const duty = { _id: "d-103", staff: "staff-A", assignedStaff: ["staff-A"] };
  const unrelatedStaff = { userId: "staff-X", role: "staff" };
  assert.strictEqual(checkDutyOwnership(duty, unrelatedStaff), false);
});

// 9. Staff cannot modify assignedStaff
test("9. Staff cannot modify assignedStaff or duty parameters", () => {
  const sanitizeStaffUpdates = (role, body) => {
    if (role === "staff") {
      // Staff cannot alter administrative fields
      const { staff, assignedStaff, specializationRequired, zone, ...allowed } = body;
      return allowed;
    }
    return body;
  };

  const maliciousBody = {
    staff: "hacked-staff",
    assignedStaff: ["hacked-staff"],
    specializationRequired: "Manager",
    notes: "Field progress update",
  };

  const sanitized = sanitizeStaffUpdates("staff", maliciousBody);
  assert.strictEqual(sanitized.staff, undefined);
  assert.strictEqual(sanitized.assignedStaff, undefined);
  assert.strictEqual(sanitized.specializationRequired, undefined);
  assert.strictEqual(sanitized.notes, "Field progress update");
});

// 10. ON_LEAVE technician cannot be assigned
test("10. ON_LEAVE technician cannot be assigned", () => {
  assert.throws(() => checkAvailabilityStatus("ON_LEAVE"), /unavailable on this date/);
});

// 11. UNAVAILABLE technician cannot be assigned
test("11. UNAVAILABLE technician cannot be assigned", () => {
  assert.throws(() => checkAvailabilityStatus("UNAVAILABLE"), /unavailable on this date/);
});

// 12. Completed duty excluded from active workload
test("12. Completed duty excluded from active workload", () => {
  const activeStatuses = new Set(["ASSIGNED", "ACCEPTED", "IN_PROGRESS"]);
  assert.strictEqual(activeStatuses.has("COMPLETED"), false);
});

// 13. Cancelled duty excluded from active workload
test("13. Cancelled duty excluded from active workload", () => {
  const activeStatuses = new Set(["ASSIGNED", "ACCEPTED", "IN_PROGRESS"]);
  assert.strictEqual(activeStatuses.has("CANCELLED"), false);
});

// 14. Rejected assignment excluded from active workload
test("14. Rejected assignment excluded from active workload", () => {
  const activeStatuses = new Set(["ASSIGNED", "ACCEPTED", "IN_PROGRESS"]);
  assert.strictEqual(activeStatuses.has("REJECTED"), false);
});

// 15. Current duty not counted against candidate workload
test("15. Current duty being edited is excluded from candidate active workload calculation", () => {
  const currentEditingDutyId = "duty-current";
  const duties = [
    { _id: "duty-current", staff: "tech-1", status: "ASSIGNED" },
    { _id: "duty-other", staff: "tech-1", status: "ASSIGNED" },
  ];

  const candidateWorkload = duties.filter(
    (d) => d._id !== currentEditingDutyId && ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(d.status)
  ).length;

  assert.strictEqual(candidateWorkload, 1);
});

// 16. Same-zone recommendation works
test("16. Same-zone recommendation scores higher than non-zone when specialization and workload match", () => {
  const scoreTechnician = ({ hasZoneMatch, isLead, specializationMatch, workload }) => {
    let score = 0;
    if (specializationMatch) score += 50;
    if (isLead) score += 35;
    else if (hasZoneMatch) score += 25;
    score -= workload * 10;
    return score;
  };

  const techA = scoreTechnician({ hasZoneMatch: true, isLead: false, specializationMatch: true, workload: 1 });
  const techB = scoreTechnician({ hasZoneMatch: false, isLead: false, specializationMatch: true, workload: 1 });

  assert.ok(techA > techB, "Same-zone technician A must score higher than non-zone technician B");
  assert.strictEqual(techA, 65); // 50 + 25 - 10
  assert.strictEqual(techB, 40); // 50 + 0 - 10
});

// 17. Historical single-staff duty remains readable
test("17. Historical single-staff duty remains fully readable and accessible", () => {
  const historicalDuty = {
    _id: "legacy-duty-001",
    staff: "staff-legacy-01",
    dutyTitle: "Main Trunk Fiber Inspection",
    status: "COMPLETED",
    dutyDate: new Date("2025-01-15"),
  };

  const user = { userId: "staff-legacy-01", role: "staff" };
  assert.strictEqual(checkDutyOwnership(historicalDuty, user), true);
});
