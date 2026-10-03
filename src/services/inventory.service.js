const Material = require("../models/material.model");
const StockTransaction = require("../models/stock-transaction.model");
const MaterialRequest = require("../models/material-request.model");
const Duty = require("../models/duty.model");
const User = require("../models/user.model");

// ==========================================
// 1. MATERIAL CATALOG MANAGEMENT
// ==========================================

const createMaterial = async (materialData) => {
  const code = (materialData.code || "").toUpperCase().trim();
  const existing = await Material.findOne({ code });
  if (existing) {
    const error = new Error(`Material with SKU code "${code}" already exists`);
    error.statusCode = 400;
    throw error;
  }

  const initialStock = Math.max(0, Number(materialData.currentStock) || 0);

  const material = await Material.create({
    ...materialData,
    code,
    currentStock: initialStock,
    minimumStock: Math.max(0, Number(materialData.minimumStock) || 10),
    unitPrice: Math.max(0, Number(materialData.unitPrice) || 0),
  });

  return material;
};

const getMaterials = async ({
  search = "",
  category = "",
  lowStock = false,
  isActive = true,
  page = 1,
  limit = 50,
} = {}) => {
  const query = {};

  if (isActive !== undefined && isActive !== "ALL") {
    query.isActive = isActive === true || isActive === "true";
  }

  if (category && category !== "ALL") {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (lowStock === true || lowStock === "true") {
    query.$expr = { $lte: ["$currentStock", "$minimumStock"] };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Material.countDocuments(query);

  const materials = await Material.find(query)
    .sort({ category: 1, name: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    materials: materials.map((m) => ({
      ...m,
      isLowStock: m.currentStock <= m.minimumStock,
    })),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

const getMaterialById = async (id) => {
  const material = await Material.findById(id).lean();
  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }
  return {
    ...material,
    isLowStock: material.currentStock <= material.minimumStock,
  };
};

const updateMaterial = async (id, updateData) => {
  if (updateData.code) {
    updateData.code = updateData.code.toUpperCase().trim();
    const existing = await Material.findOne({
      code: updateData.code,
      _id: { $ne: id },
    });
    if (existing) {
      const error = new Error(`Material with SKU code "${updateData.code}" already exists`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Prevent direct tampering of currentStock without an audit transaction
  delete updateData.currentStock;

  const material = await Material.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }

  return material;
};

const deleteMaterial = async (id) => {
  const material = await Material.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );
  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }
  return { message: "Material deactivated successfully" };
};

// ==========================================
// 2. AUDITABLE STOCK TRANSACTIONS
// ==========================================

const recordStockTransaction = async ({
  materialId,
  transactionType,
  quantity,
  dutyId = null,
  technicianId = null,
  materialRequestId = null,
  reference = "",
  notes = "",
  performedBy,
  location = "Main Store",
}) => {
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    const error = new Error("Transaction quantity must be a positive number");
    error.statusCode = 400;
    throw error;
  }

  const material = await Material.findById(materialId);
  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }

  const previousStock = material.currentStock;
  let newStock = previousStock;

  switch (transactionType) {
    case "STOCK_IN":
    case "RETURN":
      newStock = previousStock + qty;
      break;

    case "STOCK_OUT":
    case "DAMAGE":
      if (previousStock < qty) {
        const error = new Error(
          `Insufficient stock for "${material.name}". Available: ${previousStock} ${material.unit}, Requested: ${qty} ${material.unit}`
        );
        error.statusCode = 400;
        throw error;
      }
      newStock = previousStock - qty;
      break;

    case "ADJUSTMENT":
      // Direct adjustment quantity can be positive or negative delta
      newStock = Math.max(0, qty);
      break;

    case "TRANSFER":
      // Location transfer
      newStock = previousStock;
      break;

    default: {
      const error = new Error(`Invalid transaction type: ${transactionType}`);
      error.statusCode = 400;
      throw error;
    }
  }

  material.currentStock = newStock;
  await material.save();

  const transaction = await StockTransaction.create({
    material: material._id,
    location: location || material.location || "Main Store",
    transactionType,
    quantity: qty,
    previousStock,
    newStock,
    duty: dutyId || null,
    technician: technicianId || null,
    materialRequest: materialRequestId || null,
    reference: reference || "",
    performedBy,
    notes: notes || "",
  });

  return {
    material,
    transaction,
  };
};

const getStockTransactions = async ({
  materialId = "",
  transactionType = "",
  dutyId = "",
  technicianId = "",
  startDate = "",
  endDate = "",
  page = 1,
  limit = 50,
} = {}) => {
  const query = {};

  if (materialId) query.material = materialId;
  if (transactionType && transactionType !== "ALL") query.transactionType = transactionType;
  if (dutyId) query.duty = dutyId;
  if (technicianId) query.technician = technicianId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await StockTransaction.countDocuments(query);

  const transactions = await StockTransaction.find(query)
    .populate("material", "name code category unit currentStock minimumStock")
    .populate("performedBy", "name email role")
    .populate("technician", "name email specialization employeeId")
    .populate("duty", "dutyTitle zoneName status dutyDate")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    transactions,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

// ==========================================
// 3. MATERIAL REQUESTS & DUTY WORKFLOW
// ==========================================

const createMaterialRequest = async ({
  dutyId,
  technicianId,
  items = [],
  requestNotes = "",
}) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    const error = new Error("At least one material item is required");
    error.statusCode = 400;
    throw error;
  }

  const duty = await Duty.findById(dutyId);
  if (!duty) {
    const error = new Error("Field duty not found");
    error.statusCode = 404;
    throw error;
  }

  // Verify staff belongs to this duty
  const isLead = String(duty.staff?._id || duty.staff) === String(technicianId);
  const isTeam = Array.isArray(duty.assignedStaff) &&
    duty.assignedStaff.some((s) => String(s?._id || s) === String(technicianId));

  if (!isLead && !isTeam) {
    const error = new Error("You can only request materials for your assigned field duty");
    error.statusCode = 403;
    throw error;
  }

  // Validate items
  const validatedItems = [];
  for (const item of items) {
    const mat = await Material.findById(item.material);
    if (!mat || !mat.isActive) {
      const error = new Error(`Material item not found or inactive (${item.material})`);
      error.statusCode = 400;
      throw error;
    }

    const reqQty = Number(item.requestedQuantity || item.quantity);
    if (isNaN(reqQty) || reqQty <= 0) {
      const error = new Error(`Requested quantity for "${mat.name}" must be greater than zero`);
      error.statusCode = 400;
      throw error;
    }

    validatedItems.push({
      material: mat._id,
      requestedQuantity: reqQty,
      approvedQuantity: reqQty, // Default approved to requested for manager review
      issuedQuantity: 0,
      usedQuantity: 0,
      returnedQuantity: 0,
      status: "PENDING",
    });
  }

  const materialRequest = await MaterialRequest.create({
    duty: duty._id,
    technician: technicianId,
    zone: duty.zone || null,
    items: validatedItems,
    requestNotes: requestNotes || "",
    status: "PENDING",
  });

  const populated = await MaterialRequest.findById(materialRequest._id)
    .populate("items.material", "name code category unit currentStock minimumStock")
    .populate("technician", "name email phone specialization employeeId")
    .populate("duty", "dutyTitle zoneName dutyDate status");

  return populated;
};

const getMaterialRequests = async ({
  dutyId = "",
  technicianId = "",
  status = "",
  page = 1,
  limit = 50,
} = {}, user = null) => {
  const query = {};

  if (dutyId) query.duty = dutyId;
  if (status && status !== "ALL") query.status = status;

  // Enforce staff ownership
  if (user && user.role === "staff") {
    query.$or = [{ technician: user.userId }];
  } else if (technicianId) {
    query.technician = technicianId;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await MaterialRequest.countDocuments(query);

  const requests = await MaterialRequest.find(query)
    .populate("items.material", "name code category unit currentStock minimumStock")
    .populate("technician", "name email phone specialization employeeId")
    .populate("approvedBy", "name email role")
    .populate("issuedBy", "name email role")
    .populate("duty", "dutyTitle zoneName dutyDate status priority")
    .populate("zone", "name code")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    requests,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

const getMaterialRequestById = async (id, user = null) => {
  const request = await MaterialRequest.findById(id)
    .populate("items.material", "name code category unit currentStock minimumStock")
    .populate("technician", "name email phone specialization employeeId")
    .populate("approvedBy", "name email role")
    .populate("issuedBy", "name email role")
    .populate("duty", "dutyTitle zoneName dutyDate status priority staff assignedStaff")
    .populate("zone", "name code")
    .lean();

  if (!request) {
    const error = new Error("Material request not found");
    error.statusCode = 404;
    throw error;
  }

  // Staff ownership check
  if (user && user.role === "staff") {
    const techId = request.technician?._id?.toString() || request.technician?.toString();
    const dutyLead = request.duty?.staff?._id?.toString() || request.duty?.staff?.toString();
    const isTeam = Array.isArray(request.duty?.assignedStaff) &&
      request.duty.assignedStaff.some((s) => (s?._id?.toString() || s?.toString()) === user.userId);

    if (techId !== user.userId && dutyLead !== user.userId && !isTeam) {
      const error = new Error("You do not have permission to view this material request");
      error.statusCode = 403;
      throw error;
    }
  }

  return request;
};

const approveMaterialRequest = async (id, { approvedItems = [], approvalNotes = "", status = "APPROVED", managerId }) => {
  const request = await MaterialRequest.findById(id);
  if (!request) {
    const error = new Error("Material request not found");
    error.statusCode = 404;
    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error(`Cannot approve request with status "${request.status}"`);
    error.statusCode = 400;
    throw error;
  }

  if (status === "REJECTED") {
    request.status = "REJECTED";
    request.approvalNotes = approvalNotes || "Request rejected by operations manager";
    request.approvedBy = managerId;
    request.approvedAt = new Date();
    request.items.forEach((item) => {
      item.approvedQuantity = 0;
      item.status = "REJECTED";
    });
    await request.save();
    return request;
  }

  // Update approved quantities
  if (Array.isArray(approvedItems) && approvedItems.length > 0) {
    approvedItems.forEach((appItem) => {
      const match = request.items.find(
        (i) => i.material.toString() === (appItem.material || appItem.materialId).toString()
      );
      if (match) {
        match.approvedQuantity = Math.max(0, Number(appItem.approvedQuantity) || match.requestedQuantity);
        match.status = match.approvedQuantity > 0 ? "APPROVED" : "REJECTED";
      }
    });
  } else {
    request.items.forEach((item) => {
      item.approvedQuantity = item.requestedQuantity;
      item.status = "APPROVED";
    });
  }

  request.status = "APPROVED";
  request.approvalNotes = approvalNotes || "";
  request.approvedBy = managerId;
  request.approvedAt = new Date();

  await request.save();

  return MaterialRequest.findById(request._id)
    .populate("items.material", "name code category unit currentStock minimumStock")
    .populate("technician", "name email specialization employeeId")
    .populate("duty", "dutyTitle zoneName");
};

const issueMaterialRequest = async (id, { managerId, issuedItems = [] }) => {
  const request = await MaterialRequest.findById(id).populate("items.material");
  if (!request) {
    const error = new Error("Material request not found");
    error.statusCode = 404;
    throw error;
  }

  if (request.status !== "APPROVED" && request.status !== "PENDING") {
    const error = new Error(`Cannot issue materials for request with status "${request.status}"`);
    error.statusCode = 400;
    throw error;
  }

  // Verify stock availability for all items first
  for (const item of request.items) {
    let issueQty = item.approvedQuantity || item.requestedQuantity;
    if (Array.isArray(issuedItems) && issuedItems.length > 0) {
      const override = issuedItems.find(
        (i) => i.material?.toString() === item.material._id?.toString()
      );
      if (override && override.issuedQuantity !== undefined) {
        issueQty = Math.max(0, Number(override.issuedQuantity));
      }
    }

    if (issueQty > 0 && item.material.currentStock < issueQty) {
      const error = new Error(
        `Insufficient stock for "${item.material.name}". Available: ${item.material.currentStock} ${item.material.unit}, Required: ${issueQty} ${item.material.unit}`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Execute STOCK_OUT transactions
  for (const item of request.items) {
    let issueQty = item.approvedQuantity || item.requestedQuantity;
    if (Array.isArray(issuedItems) && issuedItems.length > 0) {
      const override = issuedItems.find(
        (i) => i.material?.toString() === item.material._id?.toString()
      );
      if (override && override.issuedQuantity !== undefined) {
        issueQty = Math.max(0, Number(override.issuedQuantity));
      }
    }

    if (issueQty > 0) {
      await recordStockTransaction({
        materialId: item.material._id,
        transactionType: "STOCK_OUT",
        quantity: issueQty,
        dutyId: request.duty,
        technicianId: request.technician,
        materialRequestId: request._id,
        reference: `DISPATCH-REQ-${request._id.toString().slice(-6).toUpperCase()}`,
        notes: `Material dispatched for Duty: ${request.duty}`,
        performedBy: managerId,
      });

      item.issuedQuantity = issueQty;
      item.status = "ISSUED";
    }
  }

  request.status = "ISSUED";
  request.issuedBy = managerId;
  request.issuedAt = new Date();
  await request.save();

  return MaterialRequest.findById(request._id)
    .populate("items.material", "name code category unit currentStock minimumStock")
    .populate("technician", "name email specialization employeeId")
    .populate("duty", "dutyTitle zoneName status");
};

const recordMaterialConsumption = async (dutyId, { requestId, items = [], technicianId }) => {
  const duty = await Duty.findById(dutyId);
  if (!duty) {
    const error = new Error("Field duty not found");
    error.statusCode = 404;
    throw error;
  }

  // Verify staff belongs to this duty
  const isLead = String(duty.staff?._id || duty.staff) === String(technicianId);
  const isTeam = Array.isArray(duty.assignedStaff) &&
    duty.assignedStaff.some((s) => String(s?._id || s) === String(technicianId));

  if (!isLead && !isTeam) {
    const error = new Error("You do not have permission to record material consumption for this duty");
    error.statusCode = 403;
    throw error;
  }

  const request = await MaterialRequest.findOne({
    _id: requestId,
    duty: dutyId,
  }).populate("items.material");

  if (!request) {
    const error = new Error("Material request not found for this duty");
    error.statusCode = 404;
    throw error;
  }

  if (request.status !== "ISSUED" && request.status !== "PARTIALLY_RETURNED") {
    const error = new Error(`Cannot record consumption for request with status "${request.status}". Materials must be ISSUED first.`);
    error.statusCode = 400;
    throw error;
  }

  // Validate usage and returns
  for (const consumed of items) {
    const matId = consumed.material?._id?.toString() || consumed.material?.toString();
    const item = request.items.find((i) => i.material._id?.toString() === matId);

    if (!item) {
      const error = new Error(`Material "${matId}" was not part of this issued request`);
      error.statusCode = 400;
      throw error;
    }

    const used = Number(consumed.usedQuantity) || 0;
    const returned = Number(consumed.returnedQuantity) || 0;

    if (used < 0 || returned < 0) {
      const error = new Error("Used and returned quantities cannot be negative");
      error.statusCode = 400;
      throw error;
    }

    if (used > item.issuedQuantity) {
      const error = new Error(
        `Used quantity (${used} ${item.material.unit}) cannot exceed issued quantity (${item.issuedQuantity} ${item.material.unit}) for "${item.material.name}"`
      );
      error.statusCode = 400;
      throw error;
    }

    const maxReturnable = item.issuedQuantity - used;
    if (returned > maxReturnable) {
      const error = new Error(
        `Returned quantity (${returned} ${item.material.unit}) cannot exceed unconsumed quantity (${maxReturnable} ${item.material.unit}) for "${item.material.name}"`
      );
      error.statusCode = 400;
      throw error;
    }

    // Process stock RETURN if returned > 0
    if (returned > 0) {
      await recordStockTransaction({
        materialId: item.material._id,
        transactionType: "RETURN",
        quantity: returned,
        dutyId: duty._id,
        technicianId,
        materialRequestId: request._id,
        reference: `RETURN-DUTY-${duty._id.toString().slice(-6).toUpperCase()}`,
        notes: `Unused material returned after duty completion`,
        performedBy: technicianId,
      });
    }

    item.usedQuantity = used;
    item.returnedQuantity = returned;
    item.status = returned > 0 ? "RETURNED" : "COMPLETED";
  }

  request.status = "COMPLETED";
  await request.save();

  return MaterialRequest.findById(request._id)
    .populate("items.material", "name code category unit currentStock minimumStock")
    .populate("technician", "name email specialization employeeId")
    .populate("duty", "dutyTitle zoneName status");
};

const cancelMaterialRequest = async (id, technicianId) => {
  const request = await MaterialRequest.findById(id);
  if (!request) {
    const error = new Error("Material request not found");
    error.statusCode = 404;
    throw error;
  }

  if (request.technician.toString() !== technicianId.toString()) {
    const error = new Error("You can only cancel your own material requests");
    error.statusCode = 403;
    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error(`Cannot cancel request with status "${request.status}"`);
    error.statusCode = 400;
    throw error;
  }

  request.status = "CANCELLED";
  await request.save();
  return { message: "Material request cancelled successfully" };
};

// ==========================================
// 4. LOW STOCK & INVENTORY SUMMARY
// ==========================================

const getInventorySummary = async () => {
  const materials = await Material.find({ isActive: true }).lean();

  let totalItems = materials.length;
  let lowStockCount = 0;
  let totalValuation = 0;
  const categorySummary = {};

  materials.forEach((m) => {
    const isLow = m.currentStock <= m.minimumStock;
    if (isLow) lowStockCount++;
    totalValuation += (m.currentStock || 0) * (m.unitPrice || 0);

    const cat = m.category || "Other";
    categorySummary[cat] = (categorySummary[cat] || 0) + 1;
  });

  const recentTransactions = await StockTransaction.find()
    .populate("material", "name code unit")
    .populate("performedBy", "name role")
    .populate("technician", "name")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const pendingRequestsCount = await MaterialRequest.countDocuments({ status: "PENDING" });

  return {
    totalMaterials: totalItems,
    lowStockCount,
    totalValuation: Math.round(totalValuation * 100) / 100,
    pendingRequestsCount,
    categorySummary,
    recentTransactions,
  };
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
