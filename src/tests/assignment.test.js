const test = require("node:test");
const assert = require("node:assert");

const {
  computeDutyHoursAndAmount,
} = require("../services/assignment.service");

const {
  mapJobTypeToTechnicianRole,
  mapCategoryToDepartment,
} = require("../services/department.service");

const {
  emitDutyAssigned,
  emitDutyReassigned,
  emitDutyStatusChanged,
  emitDutyCancelled,
} = require("../socket");

test("computeDutyHoursAndAmount calculates shift hours and payout rate accurately", () => {
  const result = computeDutyHoursAndAmount("09:00", "17:00", 150);
  assert.strictEqual(result.totalHours, 8);
  assert.strictEqual(result.totalAmount, 1200);
  assert.strictEqual(result.hourlyRate, 150);
});

test("computeDutyHoursAndAmount correctly handles overnight emergency shifts", () => {
  const result = computeDutyHoursAndAmount("22:00", "04:00", 200);
  assert.strictEqual(result.totalHours, 6);
  assert.strictEqual(result.totalAmount, 1200);
});

test("Specialization mapping matches operational duties to CableOps technicians", () => {
  const fiberDuty = mapJobTypeToTechnicianRole("FIBER_SPLICING", "Fiber Joint Splicing");
  assert.strictEqual(fiberDuty.specialization, "Fiber Technician");
  assert.strictEqual(fiberDuty.department, "Fiber Optics & Splicing");

  const lineDuty = mapJobTypeToTechnicianRole("LINE_REPAIR", "Coaxial Trunk Fault");
  assert.strictEqual(lineDuty.specialization, "Linesman");
  assert.strictEqual(lineDuty.department, "Field Linesmen & Wiring");

  const installDuty = mapJobTypeToTechnicianRole("NEW_INSTALLATION", "FTTH ONU Setup");
  assert.strictEqual(installDuty.specialization, "Installation Technician");
  assert.strictEqual(installDuty.department, "New Installations & STB Setup");

  const nocDuty = mapJobTypeToTechnicianRole("NODE_MAINTENANCE", "Node Maintenance");
  assert.strictEqual(nocDuty.specialization, "NOC Specialist");
  assert.strictEqual(nocDuty.department, "Network Operations (NOC)");
});

test("Socket event helpers execute safely without unhandled exceptions when io is null or active", () => {
  const mockDuty = {
    _id: "507f1f77bcf86cd799439011",
    staff: "507f1f77bcf86cd799439012",
    assignedStaff: ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
  };

  assert.doesNotThrow(() => emitDutyAssigned(mockDuty));
  assert.doesNotThrow(() => emitDutyReassigned(mockDuty, "507f1f77bcf86cd799439014"));
  assert.doesNotThrow(() => emitDutyStatusChanged(mockDuty));
  assert.doesNotThrow(() => emitDutyCancelled(mockDuty));
});
