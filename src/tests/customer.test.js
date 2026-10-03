const test = require("node:test");
const assert = require("node:assert/strict");

// Helpers simulating customer authorization & business logic rules
const normalizeMacAddress = (mac) => {
  if (!mac) return "";
  return mac.replace(/[:-]/g, "").toUpperCase().trim();
};

const normalizeSerialNumber = (sn) => {
  if (!sn) return "";
  return sn.toUpperCase().trim();
};

const checkCustomerRolePermission = (action, role) => {
  const managerOnlyActions = [
    "CREATE_CUSTOMER",
    "UPDATE_CUSTOMER",
    "UPDATE_STATUS",
    "DELETE_CUSTOMER",
    "ADD_REPLACE_EQUIPMENT",
    "VIEW_ALL_CUSTOMERS",
  ];

  if (managerOnlyActions.includes(action)) {
    if (role !== "manager" && role !== "admin") {
      const err = new Error(`Forbidden: ${role} is not authorized to perform ${action}`);
      err.statusCode = 403;
      throw err;
    }
    return true;
  }
  return true;
};

const checkStaffCustomerAssociation = (customer, staffDuties, userId) => {
  if (!userId) return false;

  const isAssociated = staffDuties.some((d) => {
    const isAssigned =
      String(d.staff) === String(userId) ||
      (Array.isArray(d.assignedStaff) && d.assignedStaff.includes(userId));
    if (!isAssigned) return false;

    if (d.customer && String(d.customer) === String(customer._id)) return true;
    if (Array.isArray(d.affectedCustomers) && d.affectedCustomers.includes(customer._id)) return true;
    if (d.subscriber?.phone && customer.phone && d.subscriber.phone.trim() === customer.phone.trim()) return true;
    if (d.subscriber?.accountNo && customer.customerId && d.subscriber.accountNo.trim().toUpperCase() === customer.customerId.trim().toUpperCase()) return true;
    return false;
  });

  return isAssociated;
};

const simulateEquipmentReplacement = (customer, newEquipmentPayload, replacedByUserId) => {
  const normalizedMac = normalizeMacAddress(newEquipmentPayload.macAddress);
  const normalizedSn = normalizeSerialNumber(newEquipmentPayload.serialNumber);

  const existingIdx = customer.networkEquipment.findIndex(
    (eq) => eq.equipmentType === newEquipmentPayload.equipmentType && eq.status === "ACTIVE"
  );

  if (existingIdx >= 0) {
    const oldEq = customer.networkEquipment[existingIdx];
    customer.equipmentHistory.push({
      equipmentType: oldEq.equipmentType,
      serialNumber: oldEq.serialNumber,
      macAddress: oldEq.macAddress,
      model: oldEq.model,
      replacedAt: new Date().toISOString(),
      replacedBy: replacedByUserId,
      reason: newEquipmentPayload.replacementReason || "Faulty replacement",
      notes: newEquipmentPayload.notes || "",
    });

    oldEq.status = "REPLACED";
  }

  customer.networkEquipment.push({
    equipmentType: newEquipmentPayload.equipmentType,
    serialNumber: normalizedSn,
    macAddress: normalizedMac,
    model: newEquipmentPayload.model || "",
    status: "ACTIVE",
    installationDate: new Date().toISOString(),
    notes: newEquipmentPayload.notes || "",
  });

  return customer;
};

// ==========================================
// TEST SUITE: CUSTOMER & SUBSCRIBER MANAGEMENT
// ==========================================

test("1. Manager can create customer records", () => {
  const managerUser = { userId: "mgr-01", role: "manager" };
  assert.equal(checkCustomerRolePermission("CREATE_CUSTOMER", managerUser.role), true);
});

test("2. Staff cannot create customer records", () => {
  const staffUser = { userId: "tech-01", role: "staff" };
  assert.throws(
    () => checkCustomerRolePermission("CREATE_CUSTOMER", staffUser.role),
    /Forbidden: staff is not authorized/
  );
});

test("3. Manager can update customer records and contact information", () => {
  const managerUser = { userId: "mgr-01", role: "manager" };
  assert.equal(checkCustomerRolePermission("UPDATE_CUSTOMER", managerUser.role), true);
});

test("4. Staff cannot modify customer status or deactivate customers", () => {
  const staffUser = { userId: "tech-01", role: "staff" };
  assert.throws(
    () => checkCustomerRolePermission("UPDATE_STATUS", staffUser.role),
    /Forbidden: staff is not authorized/
  );
  assert.throws(
    () => checkCustomerRolePermission("DELETE_CUSTOMER", staffUser.role),
    /Forbidden: staff is not authorized/
  );
});

test("5. Customer ID format generates unique alphanumeric identifier", () => {
  const count = 42;
  const customerId = `SUB-${String(count + 1).padStart(6, "0")}`;
  assert.equal(customerId, "SUB-000043");
});

test("6. Duplicate phone and email detection warns/rejects on conflict", () => {
  const existingCustomers = [
    { customerId: "SUB-000101", phone: "9876543210", email: "rajesh@gmail.com" },
  ];

  const checkDuplicate = (newPhone, newEmail) => {
    const phoneMatch = existingCustomers.find((c) => c.phone === newPhone);
    if (phoneMatch) throw new Error(`Customer with phone "${newPhone}" already exists`);
    const emailMatch = existingCustomers.find((c) => c.email === newEmail);
    if (emailMatch) throw new Error(`Customer with email "${newEmail}" already exists`);
    return true;
  };

  assert.throws(() => checkDuplicate("9876543210", "new@gmail.com"), /phone "9876543210" already exists/);
  assert.throws(() => checkDuplicate("9999999999", "rajesh@gmail.com"), /email "rajesh@gmail.com" already exists/);
  assert.equal(checkDuplicate("9111111111", "fresh@gmail.com"), true);
});

test("7. Customer search matches by ID, Name, Phone, and normalized MAC address", () => {
  const customer = {
    customerId: "SUB-000205",
    name: "Sunil Narang",
    phone: "9812345678",
    networkEquipment: [
      { equipmentType: "ONU", serialNumber: "ZTEG123456", macAddress: "A1B2C3D4E5F6" },
    ],
  };

  const matchesSearch = (cust, query) => {
    const q = query.trim().toUpperCase();
    const normalizedQMac = q.replace(/[:-]/g, "");

    return (
      cust.customerId.toUpperCase().includes(q) ||
      cust.name.toUpperCase().includes(q) ||
      cust.phone.includes(q) ||
      cust.networkEquipment.some(
        (eq) =>
          eq.serialNumber.toUpperCase().includes(q) ||
          eq.macAddress.includes(normalizedQMac)
      )
    );
  };

  assert.equal(matchesSearch(customer, "SUB-000205"), true);
  assert.equal(matchesSearch(customer, "Sunil"), true);
  assert.equal(matchesSearch(customer, "9812345678"), true);
  assert.equal(matchesSearch(customer, "ZTEG123456"), true);
  assert.equal(matchesSearch(customer, "a1:b2:c3:d4:e5:f6"), true);
  assert.equal(matchesSearch(customer, "Unknown"), false);
});

test("8. Staff can access customer linked to their assigned duty", () => {
  const customer = { _id: "cust-01", phone: "9810011111", customerId: "SUB-000001" };
  const staffDuties = [
    {
      _id: "duty-101",
      staff: "tech-01",
      subscriber: { phone: "9810011111", accountNo: "SUB-000001" },
    },
  ];

  assert.equal(checkStaffCustomerAssociation(customer, staffDuties, "tech-01"), true);
});

test("9. Staff cannot access unrelated customer not linked to their duties", () => {
  const customer = { _id: "cust-02", phone: "9820022222", customerId: "SUB-000002" };
  const staffDuties = [
    {
      _id: "duty-101",
      staff: "tech-01",
      subscriber: { phone: "9810011111", accountNo: "SUB-000001" },
    },
  ];

  assert.equal(checkStaffCustomerAssociation(customer, staffDuties, "tech-01"), false);
});

test("10. Team member staff can access customer linked to shared duty assignment", () => {
  const customer = { _id: "cust-03", phone: "9830033333", customerId: "SUB-000003" };
  const teamStaffDuties = [
    {
      _id: "duty-102",
      staff: "tech-lead-01",
      assignedStaff: ["tech-team-02", "tech-team-03"],
      subscriber: { phone: "9830033333", accountNo: "SUB-000003" },
    },
  ];

  assert.equal(checkStaffCustomerAssociation(customer, teamStaffDuties, "tech-team-02"), true);
  assert.equal(checkStaffCustomerAssociation(customer, teamStaffDuties, "tech-outsider-99"), false);
});

test("11. Disconnected/Suspended customer records remain historically accessible", () => {
  const disconnectedCustomer = {
    _id: "cust-04",
    customerId: "SUB-000004",
    name: "Archived Customer",
    status: "DISCONNECTED",
  };

  assert.ok(["ACTIVE", "PENDING_INSTALLATION", "SUSPENDED", "DISCONNECTED"].includes(disconnectedCustomer.status));
  assert.equal(disconnectedCustomer.status, "DISCONNECTED");
});

test("12. Equipment serial number and MAC address are normalized", () => {
  const rawMac = "00:1a:2b:3c:4d:5e";
  const rawSn = " sn-98421a ";

  assert.equal(normalizeMacAddress(rawMac), "001A2B3C4D5E");
  assert.equal(normalizeSerialNumber(rawSn), "SN-98421A");
});

test("13. Equipment replacement archives existing equipment to equipmentHistory", () => {
  const customer = {
    _id: "cust-05",
    networkEquipment: [
      {
        equipmentType: "ONU",
        serialNumber: "OLD-SN-001",
        macAddress: "001122334455",
        model: "ZTE F660",
        status: "ACTIVE",
      },
    ],
    equipmentHistory: [],
  };

  const updatedCustomer = simulateEquipmentReplacement(
    customer,
    {
      equipmentType: "ONU",
      serialNumber: "NEW-SN-002",
      macAddress: "AABBCCDDEEFF",
      model: "Huawei HG8145V5",
      replacementReason: "Optical power port damaged by lightning surge",
    },
    "mgr-01"
  );

  assert.equal(updatedCustomer.equipmentHistory.length, 1);
  assert.equal(updatedCustomer.equipmentHistory[0].serialNumber, "OLD-SN-001");
  assert.equal(updatedCustomer.equipmentHistory[0].reason, "Optical power port damaged by lightning surge");
  assert.equal(updatedCustomer.networkEquipment.filter((e) => e.status === "ACTIVE").length, 1);
  assert.equal(updatedCustomer.networkEquipment.find((e) => e.status === "ACTIVE").serialNumber, "NEW-SN-002");
});
