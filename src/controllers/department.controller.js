const departmentService = require("../services/department.service");

/**
 * GET /api/departments
 */
const getDepartmentStats = async (req, res, next) => {
  try {
    const result = await departmentService.getDepartmentStats();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/departments/recommendations
 */
const getStaffRecommendations = async (req, res, next) => {
  try {
    const { department, specialization, jobType, serviceName, zone, date } = req.query;
    const staff = await departmentService.getStaffRecommendations({
      department,
      specialization,
      jobType,
      serviceName,
      zone,
      dutyDate: date,
    });
    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartmentStats,
  getStaffRecommendations,
};
