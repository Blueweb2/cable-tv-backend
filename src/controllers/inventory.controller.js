const inventoryService = require("../services/inventory.service");

// ==========================================
// MATERIAL CATALOG CONTROLLERS
// ==========================================

const createMaterial = async (req, res, next) => {
  try {
    const material = await inventoryService.createMaterial(req.body);
    res.status(201).json({
      success: true,
      message: "Material created successfully",
      data: material,
    });
  } catch (error) {
    next(error);
  }
};

const getMaterials = async (req, res, next) => {
  try {
    const result = await inventoryService.getMaterials(req.query);
    res.status(200).json({
      success: true,
      data: result.materials,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getMaterialById = async (req, res, next) => {
  try {
    const material = await inventoryService.getMaterialById(req.params.id);
    res.status(200).json({
      success: true,
      data: material,
    });
  } catch (error) {
    next(error);
  }
};

const updateMaterial = async (req, res, next) => {
  try {
    const material = await inventoryService.updateMaterial(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "Material updated successfully",
      data: material,
    });
  } catch (error) {
    next(error);
  }
};

const deleteMaterial = async (req, res, next) => {
  try {
    const result = await inventoryService.deleteMaterial(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// STOCK TRANSACTION CONTROLLERS
// ==========================================

const recordStockTransaction = async (req, res, next) => {
  try {
    const transaction = await inventoryService.recordStockTransaction(
      req.body,
      req.user.id || req.user.userId || req.user._id
    );
    res.status(201).json({
      success: true,
      message: "Stock transaction recorded successfully",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

const getStockTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const userRole = req.user.role;
    const result = await inventoryService.getStockTransactions(req.query, userId, userRole);
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// MATERIAL REQUEST & ISSUE CONTROLLERS
// ==========================================

const createMaterialRequest = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const userRole = req.user.role;
    const request = await inventoryService.createMaterialRequest(req.body, userId, userRole);
    res.status(201).json({
      success: true,
      message: "Material request created successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const getMaterialRequests = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const userRole = req.user.role;
    const result = await inventoryService.getMaterialRequests(req.query, userId, userRole);
    res.status(200).json({
      success: true,
      data: result.requests,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getMaterialRequestById = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const userRole = req.user.role;
    const request = await inventoryService.getMaterialRequestById(req.params.id, userId, userRole);
    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const approveMaterialRequest = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const request = await inventoryService.approveMaterialRequest(req.params.id, req.body, userId);
    res.status(200).json({
      success: true,
      message: "Material request updated successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const issueMaterialRequest = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const request = await inventoryService.issueMaterialRequest(req.params.id, req.body, userId);
    res.status(200).json({
      success: true,
      message: "Materials issued successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const recordMaterialConsumption = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const userRole = req.user.role;
    const request = await inventoryService.recordMaterialConsumption(
      req.params.id,
      req.body,
      userId,
      userRole
    );
    res.status(200).json({
      success: true,
      message: "Material consumption recorded successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const cancelMaterialRequest = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const userRole = req.user.role;
    const result = await inventoryService.cancelMaterialRequest(req.params.id, userId, userRole);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SUMMARY & LOW STOCK CONTROLLER
// ==========================================

const getInventorySummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMaterial,
  getMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  recordStockTransaction,
  getStockTransactions,
  createMaterialRequest,
  getMaterialRequests,
  getMaterialRequestById,
  approveMaterialRequest,
  issueMaterialRequest,
  recordMaterialConsumption,
  cancelMaterialRequest,
  getInventorySummary,
};
