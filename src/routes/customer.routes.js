const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect);

// ==========================================
// Customer CRUD Routes
// ==========================================
router
  .route("/")
  .get(customerController.getCustomers) // Filtered by service for staff
  .post(
    restrictTo("admin", "manager"),
    customerController.createCustomer
  );

router
  .route("/:id")
  .get(customerController.getCustomerById) // Verified by service for staff
  .put(
    restrictTo("admin", "manager"),
    customerController.updateCustomer
  );

router.patch(
  "/:id/status",
  restrictTo("admin", "manager"),
  customerController.updateCustomerStatus
);

router.get(
  "/:id/duties",
  customerController.getCustomerDuties
);

router.post(
  "/:id/equipment",
  restrictTo("admin", "manager"),
  customerController.addOrReplaceEquipment
);

module.exports = router;
