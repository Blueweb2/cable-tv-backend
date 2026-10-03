const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventory.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect);

// ==========================================
// INVENTORY SUMMARY (Manager / Admin)
// ==========================================
router.get(
  "/summary",
  restrictTo("admin", "manager"),
  inventoryController.getInventorySummary
);

// ==========================================
// MATERIAL CATALOG ROUTES
// ==========================================
router
  .route("/materials")
  .get(inventoryController.getMaterials)
  .post(
    restrictTo("admin", "manager"),
    inventoryController.createMaterial
  );

router
  .route("/materials/:id")
  .get(inventoryController.getMaterialById)
  .put(
    restrictTo("admin", "manager"),
    inventoryController.updateMaterial
  )
  .delete(
    restrictTo("admin", "manager"),
    inventoryController.deleteMaterial
  );

// ==========================================
// STOCK TRANSACTION ROUTES
// ==========================================
router
  .route("/transactions")
  .get(inventoryController.getStockTransactions)
  .post(
    restrictTo("admin", "manager"),
    inventoryController.recordStockTransaction
  );

// ==========================================
// MATERIAL REQUESTS & WORKFLOW ROUTES
// ==========================================
router
  .route("/requests")
  .get(inventoryController.getMaterialRequests)
  .post(inventoryController.createMaterialRequest);

router
  .route("/requests/:id")
  .get(inventoryController.getMaterialRequestById);

router.patch(
  "/requests/:id/approve",
  restrictTo("admin", "manager"),
  inventoryController.approveMaterialRequest
);

router.patch(
  "/requests/:id/issue",
  restrictTo("admin", "manager"),
  inventoryController.issueMaterialRequest
);

router.patch(
  "/requests/:id/consume",
  inventoryController.recordMaterialConsumption
);

router.patch(
  "/requests/:id/cancel",
  inventoryController.cancelMaterialRequest
);

module.exports = router;
