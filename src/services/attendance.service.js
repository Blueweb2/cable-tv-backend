const Attendance = require("../models/attendance.model");
const Duty = require("../models/duty.model");
const User = require("../models/user.model");

/**
 * Shared populate helper
 */
const defaultPopulate = (query) =>
  query
    .populate("staff", "name username employeeId department phone location")
    .populate("duty", "dutyTitle role dutyDate startTime endTime status jobType priority zoneName")
    .populate("zone", "name code zoneType coverageArea")
    .populate("markedBy", "name username role");

/**
 * Determine PRESENT vs LATE based on duty/shift startTime
 */
const resolveStatus = (dutyRecord, now) => {
  if (!dutyRecord || !dutyRecord.startTime) return "PRESENT";
  const [hours, minutes] = dutyRecord.startTime.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "PRESENT";
  const expected = new Date(dutyRecord.dutyDate || now);
  expected.setHours(hours, minutes, 0, 0);
  return now > expected ? "LATE" : "PRESENT";
};

/**
 * Calculate active shift duration
 */
const computeActiveMinutes = (attendance, now = new Date()) => {
  if (!attendance.checkIn) return 0;
  const end = attendance.checkOut || now;
  const totalElapsedMinutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(attendance.checkIn).getTime()) / 60000)
  );
  return Math.max(0, totalElapsedMinutes - (attendance.totalPauseMinutes || 0));
};

/**
 * Technician Check In / Punch In
 * POST /api/attendance/check-in
 */
const checkIn = async ({ duty = null, zone = null, staffId, location = "", notes = "", markedBy = null }) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  let dutyRecord = null;
  if (duty) {
    dutyRecord = await Duty.findById(duty);
    if (!dutyRecord) {
      const e = new Error("Duty not found");
      e.statusCode = 404;
      throw e;
    }
    if (staffId && String(dutyRecord.staff) !== String(staffId)) {
      const e = new Error("You can only check in for your assigned field duty");
      e.statusCode = 403;
      throw e;
    }
    // Update duty status to IN_PROGRESS
    if (dutyRecord.status === "ASSIGNED" || dutyRecord.status === "ACCEPTED") {
      dutyRecord.status = "IN_PROGRESS";
      await dutyRecord.save();
    }
  }

  // Check if active attendance already exists for today / this duty
  const query = { staff: staffId, date: { $gte: todayStart, $lte: todayEnd } };
  if (duty) query.duty = duty;

  let existing = await Attendance.findOne(query);

  if (existing && existing.checkIn && !existing.checkOut) {
    const e = new Error("You are already punched in for this shift");
    e.statusCode = 400;
    throw e;
  }

  const initialStatus = dutyRecord ? resolveStatus(dutyRecord, now) : "PRESENT";

  if (!existing) {
    existing = new Attendance({
      staff: staffId,
      duty: duty || null,
      zone: zone || (dutyRecord ? dutyRecord.zone : null),
      date: now,
      checkIn: now,
      locationCheckIn: location,
      status: initialStatus,
      notes,
      markedBy: markedBy || staffId,
      sessions: [
        {
          type: "CLOCK_IN",
          timestamp: now,
          notes: location ? `Check in at ${location}` : "Shift punch-in",
        },
      ],
    });
  } else {
    // Re-check in or update
    existing.checkIn = now;
    existing.checkOut = null;
    existing.isPaused = false;
    existing.pausedAt = null;
    existing.locationCheckIn = location || existing.locationCheckIn;
    existing.sessions.push({
      type: "CLOCK_IN",
      timestamp: now,
      notes: location ? `Re-punched in at ${location}` : "Shift resume punch-in",
    });
  }

  await existing.save();
  return defaultPopulate(Attendance.findById(existing._id));
};

/**
 * Pause Shift (Field Break / Transit)
 * POST /api/attendance/pause
 */
const pauseShift = async ({ duty = null, staffId, reason = "Field Break", notes = "" }) => {
  const now = new Date();
  const query = { staff: staffId, checkOut: null };
  if (duty) query.duty = duty;

  const attendance = await Attendance.findOne(query).sort({ createdAt: -1 });
  if (!attendance || !attendance.checkIn) {
    const e = new Error("No active shift found to pause");
    e.statusCode = 404;
    throw e;
  }

  if (attendance.isPaused) {
    const e = new Error("Shift is already paused");
    e.statusCode = 400;
    throw e;
  }

  attendance.isPaused = true;
  attendance.pausedAt = now;
  attendance.sessions.push({
    type: "PAUSE",
    timestamp: now,
    reason,
    notes,
  });

  await attendance.save();
  return defaultPopulate(Attendance.findById(attendance._id));
};

/**
 * Resume Shift
 * POST /api/attendance/resume
 */
const resumeShift = async ({ duty = null, staffId, notes = "" }) => {
  const now = new Date();
  const query = { staff: staffId, checkOut: null };
  if (duty) query.duty = duty;

  const attendance = await Attendance.findOne(query).sort({ createdAt: -1 });
  if (!attendance || !attendance.checkIn) {
    const e = new Error("No active shift found to resume");
    e.statusCode = 404;
    throw e;
  }

  if (!attendance.isPaused || !attendance.pausedAt) {
    const e = new Error("Shift is not currently paused");
    e.statusCode = 400;
    throw e;
  }

  const pauseDurationMinutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(attendance.pausedAt).getTime()) / 60000)
  );

  attendance.totalPauseMinutes = (attendance.totalPauseMinutes || 0) + pauseDurationMinutes;
  attendance.pauseHistory.push({
    pausedAt: attendance.pausedAt,
    resumedAt: now,
    durationMinutes: pauseDurationMinutes,
    reason: attendance.sessions[attendance.sessions.length - 1]?.reason || "Break",
  });

  attendance.isPaused = false;
  attendance.pausedAt = null;
  attendance.sessions.push({
    type: "RESUME",
    timestamp: now,
    notes,
  });

  attendance.activeMinutes = computeActiveMinutes(attendance, now);
  attendance.totalHours = Math.round((attendance.activeMinutes / 60) * 100) / 100;

  await attendance.save();
  return defaultPopulate(Attendance.findById(attendance._id));
};

/**
 * Check Out / Punch Out
 * POST /api/attendance/check-out
 */
const checkOut = async ({ duty = null, staffId, location = "", notes = "" }) => {
  const now = new Date();
  const query = { staff: staffId, checkOut: null };
  if (duty) query.duty = duty;

  const attendance = await Attendance.findOne(query).sort({ createdAt: -1 });
  if (!attendance || !attendance.checkIn) {
    const e = new Error("No active shift found to punch out");
    e.statusCode = 404;
    throw e;
  }

  // If paused when checking out, calculate final pause time
  if (attendance.isPaused && attendance.pausedAt) {
    const pauseMins = Math.max(
      0,
      Math.round((now.getTime() - new Date(attendance.pausedAt).getTime()) / 60000)
    );
    attendance.totalPauseMinutes = (attendance.totalPauseMinutes || 0) + pauseMins;
    attendance.pauseHistory.push({
      pausedAt: attendance.pausedAt,
      resumedAt: now,
      durationMinutes: pauseMins,
      reason: "Clock out during pause",
    });
    attendance.isPaused = false;
    attendance.pausedAt = null;
  }

  attendance.checkOut = now;
  attendance.locationCheckOut = location;
  if (notes) attendance.notes = attendance.notes ? `${attendance.notes} | ${notes}` : notes;

  attendance.sessions.push({
    type: "CLOCK_OUT",
    timestamp: now,
    notes: location ? `Punched out at ${location}` : "Shift completed",
  });

  attendance.activeMinutes = computeActiveMinutes(attendance, now);
  attendance.totalHours = Math.round((attendance.activeMinutes / 60) * 100) / 100;

  await attendance.save();

  // If duty attached and completed, can update duty status
  if (attendance.duty) {
    await Duty.findByIdAndUpdate(attendance.duty, {
      totalHours: attendance.totalHours,
    });
  }

  return defaultPopulate(Attendance.findById(attendance._id));
};

/**
 * Get attendance records with filters
 */
const getAttendance = async ({
  staff,
  zone,
  date,
  startDate,
  endDate,
  status,
  page = 1,
  limit = 50,
} = {}) => {
  const query = {};

  if (staff) query.staff = staff;
  if (zone) query.zone = zone;
  if (status && status !== "ALL") query.status = status;

  if (date) {
    const d = new Date(date);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = new Date(d.setHours(23, 59, 59, 999));
    query.date = { $gte: startOfDay, $lte: endOfDay };
  } else if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Attendance.countDocuments(query);

  const records = await defaultPopulate(
    Attendance.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(Number(limit))
  ).lean();

  return {
    records,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get single attendance record
 */
const getAttendanceById = async (id) => {
  const record = await defaultPopulate(Attendance.findById(id)).lean();
  if (!record) {
    const e = new Error("Attendance record not found");
    e.statusCode = 404;
    throw e;
  }
  return record;
};

/**
 * Manager manually mark attendance
 */
const markAttendance = async ({ staff, duty = null, zone = null, date, checkInTime, checkOutTime, status = "PRESENT", notes = "", markedBy }) => {
  const checkInDate = checkInTime ? new Date(checkInTime) : new Date(date);
  const checkOutDate = checkOutTime ? new Date(checkOutTime) : null;

  let activeMinutes = 0;
  let totalHours = 0;
  if (checkInDate && checkOutDate) {
    activeMinutes = Math.max(0, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 60000));
    totalHours = Math.round((activeMinutes / 60) * 100) / 100;
  }

  const record = await Attendance.create({
    staff,
    duty,
    zone,
    date: new Date(date),
    checkIn: checkInDate,
    checkOut: checkOutDate,
    activeMinutes,
    totalHours,
    status,
    notes,
    markedBy,
  });

  return defaultPopulate(Attendance.findById(record._id));
};

module.exports = {
  checkIn,
  pauseShift,
  resumeShift,
  checkOut,
  getAttendance,
  getAttendanceById,
  markAttendance,
};
