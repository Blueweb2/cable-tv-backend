const express = require("express");
const router = express.Router();
const zoneController = require("../controllers/zone.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect);

router
  .route("/")
  .get(zoneController.getAllZones)
  .post(restrictTo("admin", "manager"), zoneController.createZone);

router
  .route("/:id")
  .get(zoneController.getZoneById)
  .put(restrictTo("admin", "manager"), zoneController.updateZone)
  .delete(restrictTo("admin", "manager"), zoneController.deleteZone);

router
  .route("/:id/assign")
  .patch(restrictTo("admin", "manager"), zoneController.assignTechnicians);

module.exports = router;
