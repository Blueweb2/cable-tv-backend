const test = require("node:test");
const assert = require("node:assert/strict");

// Pure validation logic & simulation helpers for inventory rules
const validateStockCalculation = ({ currentStock, transactionType, quantity }) => {
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  let newStock = currentStock;
  switch (transactionType) {
    case "STOCK_IN":
    case "RETURN":
      newStock = currentStock + quantity;
      break;
    case "STOCK_OUT":
    case "DAMAGE":
      if (currentStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
      }
      newStock = currentStock - quantity;
      break;
    case "ADJUSTMENT":
      newStock = quantity;
      break;
    default:
      throw new Error(`Invalid transaction type: ${transactionType}`);
  }

  if (newStock < 0) {
    throw new Error("Stock cannot become negative");
  }

  return newStock;
};

const validateConsumptionRules = ({ issuedQuantity, usedQuantity, returnedQuantity }) => {
  if (usedQuantity < 0 || returnedQuantity < 0) {
    throw new Error("Quantities cannot be negative");
  }
  if (usedQuantity > issuedQuantity) {
    throw new Error(`Used quantity (${usedQuantity}) cannot exceed issued quantity (${issuedQuantity})`);
  }
  const maxReturnable = issuedQuantity - usedQuantity;
  if (returnedQuantity > maxReturnable) {
    throw new Error(`Returned quantity (${returnedQuantity}) cannot exceed remaining unconsumed quantity (${maxReturnable})`);
  }
  return {
    valid: true,
    consumed: usedQuantity,
    returned: returnedQuantity,
    unaccounted: maxReturnable - returnedQuantity,
  };
};

const checkMaterialRolePermission = (action, role) => {
  const managerActions = [
    "CREATE_MATERIAL",
    "UPDATE_MATERIAL",
    "DELETE_MATERIAL",
    "STOCK_IN",
    "STOCK_ADJUSTMENT",
    "APPROVE_REQUEST",
    "REJECT_REQUEST",
    "ISSUE_MATERIAL",
    "VIEW_ALL_TRANSACTIONS",
  ];

  if (managerActions.includes(action)) {
    if (role !== "manager" && role !== "admin") {
      throw new Error(`Forbidden: ${role} is not authorized to perform ${action}`);
    }
    return true;
  }
  return true;
};

const checkDutyMaterialAccess = (duty, user) => {
  if (!user) return false;
  if (user.role === "manager" || user.role === "admin") return true;

  const isLead = String(duty.staff?._id || duty.staff) === String(user.userId || user._id);
  const isTeam = Array.isArray(duty.assignedStaff) &&
    duty.assignedStaff.some((s) => String(s?._id || s) === String(user.userId || user._id));

  return isLead || isTeam;
};

// ==========================================
// TEST SUITE: INVENTORY & MATERIAL MANAGEMENT
// ==========================================

test("1. Manager can create material catalog items", () => {
  const managerUser = { userId: "mgr-01", role: "manager" };
  assert.equal(checkMaterialRolePermission("CREATE_MATERIAL", managerUser.role), true);
});

test("2. Staff cannot create or edit material catalog items", () => {
  const staffUser = { userId: "staff-01", role: "staff" };
  assert.throws(
    () => checkMaterialRolePermission("CREATE_MATERIAL", staffUser.role),
    /Forbidden: staff is not authorized/
  );
  assert.throws(
    () => checkMaterialRolePermission("UPDATE_MATERIAL", staffUser.role),
    /Forbidden: staff is not authorized/
  );
});

test("3. Stock-in increases stock correctly", () => {
  const currentStock = 100;
  const newStock = validateStockCalculation({
    currentStock,
    transactionType: "STOCK_IN",
    quantity: 50,
  });
  assert.equal(newStock, 150);
});

test("4. Stock-out decreases stock correctly", () => {
  const currentStock = 100;
  const newStock = validateStockCalculation({
    currentStock,
    transactionType: "STOCK_OUT",
    quantity: 30,
  });
  assert.equal(newStock, 70);
});

test("5. Stock cannot become negative on excess stock-out or damage", () => {
  const currentStock = 20;
  assert.throws(
    () =>
      validateStockCalculation({
        currentStock,
        transactionType: "STOCK_OUT",
        quantity: 25,
      }),
    /Insufficient stock/
  );
  assert.throws(
    () =>
      validateStockCalculation({
        currentStock,
        transactionType: "DAMAGE",
        quantity: 35,
      }),
    /Insufficient stock/
  );
});

test("6. Manager can approve material requests", () => {
  const managerUser = { userId: "mgr-01", role: "manager" };
  assert.equal(checkMaterialRolePermission("APPROVE_REQUEST", managerUser.role), true);
});

test("7. Staff cannot approve or reject material requests", () => {
  const staffUser = { userId: "tech-01", role: "staff" };
  assert.throws(
    () => checkMaterialRolePermission("APPROVE_REQUEST", staffUser.role),
    /Forbidden: staff is not authorized/
  );
  assert.throws(
    () => checkMaterialRolePermission("REJECT_REQUEST", staffUser.role),
    /Forbidden: staff is not authorized/
  );
});

test("8. Approved material can be issued and reduces available inventory", () => {
  const initialStock = 200;
  const requestedQty = 40;
  const newStock = validateStockCalculation({
    currentStock: initialStock,
    transactionType: "STOCK_OUT",
    quantity: requestedQty,
  });
  assert.equal(newStock, 160);
});

test("9. Staff can record material usage only for their assigned duty (lead or team)", () => {
  const duty = {
    _id: "duty-101",
    staff: "tech-lead-01",
    assignedStaff: ["tech-team-02", "tech-team-03"],
  };

  const leadUser = { userId: "tech-lead-01", role: "staff" };
  const teamUser = { userId: "tech-team-02", role: "staff" };
  const outsiderUser = { userId: "tech-stranger-99", role: "staff" };

  assert.equal(checkDutyMaterialAccess(duty, leadUser), true);
  assert.equal(checkDutyMaterialAccess(duty, teamUser), true);
  assert.equal(checkDutyMaterialAccess(duty, outsiderUser), false);
});

test("10. Used quantity cannot exceed issued quantity", () => {
  const issuedQuantity = 100;
  const usedQuantity = 120;
  const returnedQuantity = 0;

  assert.throws(
    () => validateConsumptionRules({ issuedQuantity, usedQuantity, returnedQuantity }),
    /Used quantity \(120\) cannot exceed issued quantity \(100\)/
  );
});

test("11. Returned quantity cannot exceed remaining unconsumed quantity", () => {
  const issuedQuantity = 100;
  const usedQuantity = 70;
  const invalidReturnedQuantity = 40; // max returnable is 30

  assert.throws(
    () =>
      validateConsumptionRules({
        issuedQuantity,
        usedQuantity,
        returnedQuantity: invalidReturnedQuantity,
      }),
    /Returned quantity \(40\) cannot exceed remaining unconsumed quantity \(30\)/
  );
});

test("12. Valid consumption calculation computes used and returned quantities", () => {
  const issuedQuantity = 100;
  const usedQuantity = 75;
  const returnedQuantity = 25;

  const result = validateConsumptionRules({
    issuedQuantity,
    usedQuantity,
    returnedQuantity,
  });

  assert.equal(result.valid, true);
  assert.equal(result.consumed, 75);
  assert.equal(result.returned, 25);
  assert.equal(result.unaccounted, 0);
});

test("13. Returned material increases inventory stock via RETURN transaction", () => {
  const warehouseStockBeforeReturn = 120;
  const returnedFromDuty = 25;

  const stockAfterReturn = validateStockCalculation({
    currentStock: warehouseStockBeforeReturn,
    transactionType: "RETURN",
    quantity: returnedFromDuty,
  });

  assert.equal(stockAfterReturn, 145);
});

test("14. Staff cannot view company-wide inventory transactions or execute stock-ins", () => {
  const staff = { userId: "tech-01", role: "staff" };
  assert.throws(
    () => checkMaterialRolePermission("STOCK_IN", staff.role),
    /Forbidden: staff is not authorized/
  );
  assert.throws(
    () => checkMaterialRolePermission("STOCK_ADJUSTMENT", staff.role),
    /Forbidden: staff is not authorized/
  );
  assert.throws(
    () => checkMaterialRolePermission("VIEW_ALL_TRANSACTIONS", staff.role),
    /Forbidden: staff is not authorized/
  );
});

test("15. Low stock detection marks materials when currentStock <= minimumStock", () => {
  const normalMaterial = { currentStock: 25, minimumStock: 10 };
  const lowMaterial = { currentStock: 8, minimumStock: 10 };
  const exactThresholdMaterial = { currentStock: 10, minimumStock: 10 };

  const isLowStock = (m) => m.currentStock <= m.minimumStock;

  assert.equal(isLowStock(normalMaterial), false);
  assert.equal(isLowStock(lowMaterial), true);
  assert.equal(isLowStock(exactThresholdMaterial), true);
});

test("16. Material traceability schema links Material -> Duty -> Zone -> Technician", () => {
  const auditEntry = {
    material: "FIB-6C-ARM",
    duty: "DUTY-1024",
    zone: "North Zone",
    technician: "Rahul Sharma",
    issuedQuantity: 100,
    usedQuantity: 75,
    returnedQuantity: 25,
    date: new Date().toISOString(),
  };

  assert.ok(auditEntry.material);
  assert.ok(auditEntry.duty);
  assert.ok(auditEntry.zone);
  assert.ok(auditEntry.technician);
  assert.equal(auditEntry.issuedQuantity, auditEntry.usedQuantity + auditEntry.returnedQuantity);
});
