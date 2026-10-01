const attendanceService = require("../services/attendance.service");

/**
 * Check In / Punch In
 * POST /api/attendance/check-in
 */
const checkIn = async (req, res, next) => {
  try {
    const { duty, zone, location, notes } = req.body;
    const staffId =
      (req.user.role || "").toLowerCase() === "staff"
        ? req.user.userId
        : req.body.staff || req.user.userId;

    const attendance = await attendanceService.checkIn({
      duty,
      zone,
      staffId,
      location,
      notes,
      markedBy: req.user.userId,
    });

    res.status(200).json({
      success: true,
      message: "Shift punch-in recorded successfully",
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check Out / Punch Out
 * POST /api/attendance/check-out
 */
const checkOut = async (req, res, next) => {
  try {
    const { duty, location, notes } = req.body;
    const staffId =
      (req.user.role || "").toLowerCase() === "staff"
        ? req.user.userId
        : req.body.staff || req.user.userId;

    const attendance = await attendanceService.checkOut({
      duty,
      staffId,
      location,
      notes,
    });

    res.status(200).json({
      success: true,
      message: "Shift punch-out recorded successfully",
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause Shift
 * POST /api/attendance/pause
 */
const pauseShift = async (req, res, next) => {
  try {
    const { duty, reason, notes } = req.body;
    const staffId =
      (req.user.role || "").toLowerCase() === "staff"
        ? req.user.userId
        : req.body.staff || req.user.userId;

    const attendance = await attendanceService.pauseShift({
      duty,
      staffId,
      reason,
      notes,
    });

    res.status(200).json({
      success: true,
      message: "Shift break started",
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume Shift
 * POST /api/attendance/resume
 */
const resumeShift = async (req, res, next) => {
  try {
    const { duty, notes } = req.body;
    const staffId =
      (req.user.role || "").toLowerCase() === "staff"
        ? req.user.userId
        : req.body.staff || req.user.userId;

    const attendance = await attendanceService.resumeShift({
      duty,
      staffId,
      notes,
    });

    res.status(200).json({
      success: true,
      message: "Shift resumed successfully",
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance records
 * GET /api/attendance
 */
const getAttendance = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    const role = (req.user?.role || "").toLowerCase();

    if (role === "staff") {
      filters.staff = req.user.userId;
    }

    const result = await attendanceService.getAttendance(filters);

    res.status(200).json({
      success: true,
      data: result.records,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single record
 * GET /api/attendance/:id
 */
const getAttendanceById = async (req, res, next) => {
  try {
    const attendance = await attendanceService.getAttendanceById(req.params.id);
    res.status(200).json({
      success: true,
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manager manual mark
 * POST /api/attendance/mark
 */
const markAttendance = async (req, res, next) => {
  try {
    const { staff, duty, zone, date, checkInTime, checkOutTime, status, notes } = req.body;
    const attendance = await attendanceService.markAttendance({
      staff,
      duty,
      zone,
      date,
      checkInTime,
      checkOutTime,
      status,
      notes,
      markedBy: req.user.userId,
    });

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkIn,
  checkOut,
  pauseShift,
  resumeShift,
  getAttendance,
  getAttendanceById,
  markAttendance,
};