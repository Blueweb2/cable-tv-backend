const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendance.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect);

router.post("/check-in", attendanceController.checkIn);
router.post("/check-out", attendanceController.checkOut);
router.post("/pause", attendanceController.pauseShift);
router.post("/resume", attendanceController.resumeShift);

router
  .route("/")
  .get(attendanceController.getAttendance)
  .post(restrictTo("admin", "manager"), attendanceController.markAttendance);

router.route("/:id").get(attendanceController.getAttendanceById);

module.exports = router;