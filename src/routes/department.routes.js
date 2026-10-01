const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/department.controller");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/", departmentController.getDepartmentStats);
router.get("/recommendations", departmentController.getStaffRecommendations);

module.exports = router;
