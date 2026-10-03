const customerService = require("../services/customer.service");

// ==========================================
// 1. CREATE CUSTOMER (Manager / Admin)
// ==========================================
const createCustomer = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const customer = await customerService.createCustomer(req.body, userId);

    res.status(201).json({
      success: true,
      message: "Customer / Subscriber created successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. GET ALL / SEARCH CUSTOMERS
// ==========================================
const getCustomers = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const userRole = req.user?.role;

    const result = await customerService.getCustomers(req.query, userId, userRole);

    res.status(200).json({
      success: true,
      data: result.customers,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. GET CUSTOMER BY ID
// ==========================================
const getCustomerById = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const userRole = req.user?.role;

    const customer = await customerService.getCustomerById(
      req.params.id,
      userId,
      userRole
    );

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. UPDATE CUSTOMER (Manager / Admin)
// ==========================================
const updateCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.updateCustomer(
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Customer details updated successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. UPDATE STATUS (Manager / Admin)
// ==========================================
const updateCustomerStatus = async (req, res, next) => {
  try {
    const status = req.body.status;
    const customer = await customerService.updateCustomerStatus(
      req.params.id,
      status
    );

    res.status(200).json({
      success: true,
      message: `Customer status updated to ${customer.status}`,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. GET CUSTOMER OPERATIONAL DUTIES & HISTORY
// ==========================================
const getCustomerDuties = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const userRole = req.user?.role;

    const result = await customerService.getCustomerDuties(
      req.params.id,
      userId,
      userRole
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. ADD OR REPLACE NETWORK EQUIPMENT
// ==========================================
const addOrReplaceEquipment = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const customer = await customerService.addOrReplaceEquipment(
      req.params.id,
      req.body,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Network equipment updated successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerStatus,
  getCustomerDuties,
  addOrReplaceEquipment,
};
