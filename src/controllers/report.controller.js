const Duty = require("../models/duty.model");
const Attendance = require("../models/attendance.model");
const Zone = require("../models/zone.model");
const User = require("../models/user.model");
const Expense = require("../models/expense.model");

/**
 * Get dashboard analytics for Manager Reports & Operations Hub
 * GET /api/reports/analytics
 */
const getDashboardAnalytics = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Total Staff & Active on shift
    const totalStaff = await User.countDocuments({ role: "staff", isActive: true });
    const activeShifts = await Attendance.countDocuments({
      date: { $gte: today, $lte: endOfDay },
      checkIn: { $ne: null },
      checkOut: null,
    });

    // 2. Duties stats
    const todayDuties = await Duty.find({
      dutyDate: { $gte: today, $lte: endOfDay },
    }).select("status priority jobType");

    const totalDutiesToday = todayDuties.length;
    const inProgressDuties = todayDuties.filter((d) => d.status === "IN_PROGRESS").length;
    const completedDuties = todayDuties.filter((d) => d.status === "COMPLETED").length;
    const criticalOutages = todayDuties.filter((d) => d.priority === "CRITICAL_OUTAGE").length;

    // 3. Total Staff Hours worked
    const staffHoursAggregation = await Attendance.aggregate([
      {
        $match: {
          checkIn: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: "$totalHours" },
          totalActiveMinutes: { $sum: "$activeMinutes" },
        },
      },
    ]);

    const totalStaffHours = staffHoursAggregation.length > 0 ? Math.round(staffHoursAggregation[0].totalHours || (staffHoursAggregation[0].totalActiveMinutes / 60)) : 0;

    // 4. Zone counts
    const totalZones = await Zone.countDocuments();
    const operationalZones = await Zone.countDocuments({ status: "OPERATIONAL" });

    // 5. Total Expenses
    const expenseAggregation = await Expense.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);
    const totalExpenses = expenseAggregation.length > 0 ? expenseAggregation[0].totalAmount : 0;

    // 6. Job Type Breakdown
    const jobTypeAggregation = await Duty.aggregate([
      {
        $group: {
          _id: "$jobType",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalStaff,
        activeShifts,
        totalDutiesToday,
        inProgressDuties,
        completedDuties,
        criticalOutages,
        totalStaffHours,
        totalZones,
        operationalZones,
        totalExpenses,
        jobTypeBreakdown: jobTypeAggregation,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardAnalytics,
};
