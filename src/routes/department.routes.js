const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/department.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect, restrictTo("admin", "manager"));

router.get("/", departmentController.getDepartmentStats);
router.get("/recommendations", departmentController.getStaffRecommendations);

module.exports = router;
