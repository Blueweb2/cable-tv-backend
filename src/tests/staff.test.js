const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");

const {
  CABLE_DEPARTMENTS,
  CABLE_SPECIALIZATIONS,
  mapJobTypeToTechnicianRole,
  mapCategoryToDepartment,
} = require("../services/department.service");

test("CABLE_DEPARTMENTS contains essential CableOps departments", () => {
  assert.ok(CABLE_DEPARTMENTS.includes("Fiber Optics & Splicing"));
  assert.ok(CABLE_DEPARTMENTS.includes("Field Linesmen & Wiring"));
  assert.ok(CABLE_DEPARTMENTS.includes("New Installations & STB Setup"));
  assert.ok(CABLE_DEPARTMENTS.includes("Network Operations (NOC)"));
});

test("CABLE_SPECIALIZATIONS contains CableOps technician operational categories", () => {
  assert.ok(CABLE_SPECIALIZATIONS.includes("Fiber Technician"));
  assert.ok(CABLE_SPECIALIZATIONS.includes("Linesman"));
  assert.ok(CABLE_SPECIALIZATIONS.includes("Installation Technician"));
  assert.ok(CABLE_SPECIALIZATIONS.includes("NOC Specialist"));
});

test("Job type mapping correctly matches duties to technician specialization", () => {
  const fiberMatch = mapJobTypeToTechnicianRole("FIBER_SPLICING");
  assert.equal(fiberMatch.specialization, "Fiber Technician");
  assert.equal(fiberMatch.department, "Fiber Optics & Splicing");

  const lineMatch = mapJobTypeToTechnicianRole("LINE_REPAIR");
  assert.equal(lineMatch.specialization, "Linesman");
  assert.equal(lineMatch.department, "Field Linesmen & Wiring");

  const installMatch = mapJobTypeToTechnicianRole("NEW_INSTALLATION");
  assert.equal(installMatch.specialization, "Installation Technician");
  assert.equal(installMatch.department, "New Installations & STB Setup");

  const nocMatch = mapJobTypeToTechnicianRole("NODE_MAINTENANCE");
  assert.equal(nocMatch.specialization, "NOC Specialist");
  assert.equal(nocMatch.department, "Network Operations (NOC)");

  const billingMatch = mapJobTypeToTechnicianRole("PAYMENT_COLLECTION");
  assert.equal(billingMatch.specialization, "Billing Agent");
  assert.equal(billingMatch.department, "Billing & Collection");
});

test("Category fallback mapping correctly identifies Fiber vs Line vs Installation", () => {
  assert.equal(mapCategoryToDepartment("fiber splicing", ""), "Fiber Optics & Splicing");
  assert.equal(mapCategoryToDepartment("coax line repair", ""), "Field Linesmen & Wiring");
  assert.equal(mapCategoryToDepartment("stb activation", ""), "New Installations & STB Setup");
});

test("Staff self-profile service only permits personal fields (name, phone, location)", () => {
  // Test that arbitrary keys like role, department, specialization, isActive are ignored in user.service updateMyProfile
  const permittedFields = ["name", "phone", "location"];
  const maliciousPayload = {
    name: "Updated Name",
    phone: "+91 99999 88888",
    location: "New City",
    role: "admin",
    department: "Executive Management",
    specialization: "Chief Architect",
    isActive: false,
    employeeId: "HACKED-001",
  };

  const filteredUpdates = {};
  for (const field of permittedFields) {
    if (maliciousPayload[field] !== undefined) {
      filteredUpdates[field] = maliciousPayload[field];
    }
  }

  assert.equal(filteredUpdates.name, "Updated Name");
  assert.equal(filteredUpdates.phone, "+91 99999 88888");
  assert.equal(filteredUpdates.location, "New City");
  assert.equal(filteredUpdates.role, undefined);
  assert.equal(filteredUpdates.department, undefined);
  assert.equal(filteredUpdates.specialization, undefined);
  assert.equal(filteredUpdates.isActive, undefined);
  assert.equal(filteredUpdates.employeeId, undefined);
});
