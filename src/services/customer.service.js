const Customer = require("../models/customer.model");
const Duty = require("../models/duty.model");
const Zone = require("../models/zone.model");

// Normalization helper for MAC address
const normalizeMacAddress = (mac) => {
  if (!mac) return "";
  return mac.replace(/[:-]/g, "").toUpperCase().trim();
};

// Normalization helper for serial number
const normalizeSerialNumber = (sn) => {
  if (!sn) return "";
  return sn.toUpperCase().trim();
};

// Check if staff has legitimate duty-based access to this customer
const checkStaffCustomerAccess = async (customer, userId) => {
  if (!userId) return false;

  const staffDuties = await Duty.find({
    $or: [
      { staff: userId },
      { assignedStaff: userId },
    ],
  }).lean();

  const isAssociated = staffDuties.some((d) => {
    // 1. Direct ObjectId match if duty has customer ref
    if (d.customer && String(d.customer) === String(customer._id)) return true;
    if (Array.isArray(d.affectedCustomers) && d.affectedCustomers.some((c) => String(c) === String(customer._id))) return true;
    // 2. Subscriber phone/accountNo match
    if (d.subscriber?.phone && customer.phone && d.subscriber.phone.trim() === customer.phone.trim()) return true;
    if (d.subscriber?.accountNo && customer.customerId && d.subscriber.accountNo.trim().toUpperCase() === customer.customerId.trim().toUpperCase()) return true;
    return false;
  });

  return isAssociated;
};

// ==========================================
// 1. CREATE CUSTOMER
// ==========================================
const createCustomer = async (customerData, userId = null) => {
  // Check for duplicate phone or email if provided
  if (customerData.phone) {
    const existingPhone = await Customer.findOne({
      phone: customerData.phone.trim(),
    });
    if (existingPhone) {
      const error = new Error(`Customer with phone number "${customerData.phone}" already exists (${existingPhone.customerId || existingPhone.name})`);
      error.statusCode = 409;
      error.existingCustomer = existingPhone;
      throw error;
    }
  }

  if (customerData.email && customerData.email.trim()) {
    const existingEmail = await Customer.findOne({
      email: customerData.email.toLowerCase().trim(),
    });
    if (existingEmail) {
      const error = new Error(`Customer with email "${customerData.email}" already exists (${existingEmail.customerId || existingEmail.name})`);
      error.statusCode = 409;
      error.existingCustomer = existingEmail;
      throw error;
    }
  }

  // Generate unique customer ID if not provided
  let customerId = customerData.customerId?.trim().toUpperCase();
  if (!customerId) {
    const count = await Customer.countDocuments();
    const suffix = String(count + 1001).padStart(6, "0");
    customerId = `SUB-${suffix}`;
  }

  // Check customer ID uniqueness
  const existingId = await Customer.findOne({ customerId });
  if (existingId) {
    const count = await Customer.countDocuments();
    customerId = `SUB-${String(count + 2001).padStart(6, "0")}`;
  }

  // Normalize equipment if provided
  let networkEquipment = [];
  if (Array.isArray(customerData.networkEquipment)) {
    networkEquipment = customerData.networkEquipment.map((eq) => ({
      ...eq,
      macAddress: normalizeMacAddress(eq.macAddress),
      serialNumber: normalizeSerialNumber(eq.serialNumber),
    }));
  }

  const customer = await Customer.create({
    ...customerData,
    customerId,
    networkEquipment,
    createdBy: userId,
  });

  return customer;
};

// ==========================================
// 2. GET CUSTOMERS (WITH ROLE ENFORCEMENT)
// ==========================================
const getCustomers = async ({
  search = "",
  status = "",
  zone = "",
  connectionType = "",
  page = 1,
  limit = 20,
} = {}, userId = null, userRole = "manager") => {
  const query = {};

  if (status && status !== "ALL") {
    query.status = status === "Active" ? "ACTIVE" : status === "Inactive" ? "DISCONNECTED" : status;
  }

  if (zone && zone !== "ALL") {
    query.zone = zone;
  }

  if (connectionType && connectionType !== "ALL") {
    query.connectionType = connectionType;
  }

  if (search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    const normalizedSearch = search.trim().toUpperCase();
    query.$or = [
      { name: searchRegex },
      { customerId: searchRegex },
      { phone: searchRegex },
      { alternatePhone: searchRegex },
      { email: searchRegex },
      { address: searchRegex },
      { locality: searchRegex },
      { "networkEquipment.serialNumber": normalizedSearch },
      { "networkEquipment.macAddress": normalizedSearch.replace(/[:-]/g, "") },
    ];
  }

  // If staff, restrict query strictly to customers linked to staff's assigned duties
  if (userRole === "staff") {
    const staffDuties = await Duty.find({
      $or: [{ staff: userId }, { assignedStaff: userId }],
    }).lean();

    const linkedPhones = staffDuties
      .map((d) => d.subscriber?.phone?.trim())
      .filter(Boolean);
    const linkedAccountNos = staffDuties
      .map((d) => d.subscriber?.accountNo?.trim().toUpperCase())
      .filter(Boolean);
    const linkedCustomerIds = staffDuties
      .map((d) => d.customer)
      .filter(Boolean);

    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { _id: { $in: linkedCustomerIds } },
          { phone: { $in: linkedPhones } },
          { customerId: { $in: linkedAccountNos } },
        ],
      },
    ];
  }

  const currentPage = Math.max(Number(page) || 1, 1);
  const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (currentPage - 1) * perPage;

  const [customers, total] = await Promise.all([
    Customer.find(query)
      .populate("zone", "name code")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Customer.countDocuments(query),
  ]);

  return {
    customers,
    pagination: {
      page: currentPage,
      limit: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};

// ==========================================
// 3. GET CUSTOMER BY ID
// ==========================================
const getCustomerById = async (customerId, userId = null, userRole = "manager") => {
  const customer = await Customer.findById(customerId)
    .populate("zone", "name code")
    .populate("createdBy", "name email role")
    .lean();

  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  // Staff Authorization Check
  if (userRole === "staff") {
    const hasAccess = await checkStaffCustomerAccess(customer, userId);
    if (!hasAccess) {
      const error = new Error("Forbidden: You are not authorized to view this customer's details.");
      error.statusCode = 403;
      throw error;
    }
  }

  return customer;
};

// ==========================================
// 4. UPDATE CUSTOMER
// ==========================================
const updateCustomer = async (customerId, updateData) => {
  delete updateData.createdBy;

  // If MAC address is being updated, normalize it
  if (Array.isArray(updateData.networkEquipment)) {
    updateData.networkEquipment = updateData.networkEquipment.map((eq) => ({
      ...eq,
      macAddress: normalizeMacAddress(eq.macAddress),
      serialNumber: normalizeSerialNumber(eq.serialNumber),
    }));
  }

  const customer = await Customer.findByIdAndUpdate(customerId, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("zone", "name code")
    .populate("createdBy", "name email role");

  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  return customer;
};

// ==========================================
// 5. UPDATE STATUS (ACTIVE, SUSPENDED, DISCONNECTED)
// ==========================================
const updateCustomerStatus = async (customerId, status) => {
  const validStatuses = ["ACTIVE", "PENDING_INSTALLATION", "SUSPENDED", "DISCONNECTED", "Active", "Inactive"];
  if (!validStatuses.includes(status)) {
    const error = new Error(`Invalid customer status "${status}"`);
    error.statusCode = 400;
    throw error;
  }

  const normalizedStatus = status === "Active" ? "ACTIVE" : status === "Inactive" ? "DISCONNECTED" : status;

  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { status: normalizedStatus },
    { new: true, runValidators: true }
  )
    .populate("zone", "name code")
    .populate("createdBy", "name email role");

  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  return customer;
};

// ==========================================
// 6. GET CUSTOMER OPERATIONAL DUTIES & HISTORY
// ==========================================
const getCustomerDuties = async (customerId, userId = null, userRole = "manager") => {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  if (userRole === "staff") {
    const hasAccess = await checkStaffCustomerAccess(customer, userId);
    if (!hasAccess) {
      const error = new Error("Forbidden: You do not have access to this customer's records.");
      error.statusCode = 403;
      throw error;
    }
  }

  const dutiesQuery = {
    $or: [
      { customer: customer._id },
      { affectedCustomers: customer._id },
      { "subscriber.phone": customer.phone },
      { "subscriber.accountNo": customer.customerId },
      { "subscriber.name": customer.name },
    ],
  };

  const duties = await Duty.find(dutiesQuery)
    .populate("staff", "name phone specialization employeeId")
    .populate("assignedStaff", "name phone specialization employeeId")
    .populate("zone", "name code")
    .sort({ dutyDate: -1, createdAt: -1 })
    .lean();

  return {
    customer,
    duties,
    totalDuties: duties.length,
    activeDuties: duties.filter((d) => d.status !== "COMPLETED" && d.status !== "CANCELLED").length,
  };
};

// ==========================================
// 7. NETWORK EQUIPMENT MANAGEMENT & HISTORY
// ==========================================
const addOrReplaceEquipment = async (customerId, equipmentPayload, userId = null) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  const normalizedMac = normalizeMacAddress(equipmentPayload.macAddress);
  const normalizedSn = normalizeSerialNumber(equipmentPayload.serialNumber);

  // Check uniqueness of serial number and MAC address across other customers if provided
  if (normalizedSn) {
    const existingSn = await Customer.findOne({
      _id: { $ne: customerId },
      "networkEquipment.serialNumber": normalizedSn,
      "networkEquipment.status": "ACTIVE",
    });
    if (existingSn) {
      const error = new Error(`Active equipment with Serial Number "${normalizedSn}" is already assigned to subscriber ${existingSn.customerId || existingSn.name}`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (normalizedMac) {
    const existingMac = await Customer.findOne({
      _id: { $ne: customerId },
      "networkEquipment.macAddress": normalizedMac,
      "networkEquipment.status": "ACTIVE",
    });
    if (existingMac) {
      const error = new Error(`Active equipment with MAC Address "${normalizedMac}" is already assigned to subscriber ${existingMac.customerId || existingMac.name}`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Check if customer already has active equipment of the same type (e.g. ONU)
  const existingEquipmentIndex = customer.networkEquipment.findIndex(
    (eq) => eq.equipmentType === equipmentPayload.equipmentType && eq.status === "ACTIVE"
  );

  if (existingEquipmentIndex >= 0) {
    const oldEq = customer.networkEquipment[existingEquipmentIndex];
    // Archive old equipment into equipmentHistory
    customer.equipmentHistory.push({
      equipmentType: oldEq.equipmentType,
      serialNumber: oldEq.serialNumber,
      macAddress: oldEq.macAddress,
      model: oldEq.model,
      replacedAt: new Date(),
      replacedBy: userId,
      reason: equipmentPayload.replacementReason || "Equipment replacement / upgrade",
      notes: equipmentPayload.notes || "",
    });

    // Mark old equipment replaced
    oldEq.status = "REPLACED";
  }

  // Add new equipment
  customer.networkEquipment.push({
    equipmentType: equipmentPayload.equipmentType || "ONU",
    serialNumber: normalizedSn,
    macAddress: normalizedMac,
    model: equipmentPayload.model || "",
    status: "ACTIVE",
    installationDate: equipmentPayload.installationDate || new Date(),
    notes: equipmentPayload.notes || "",
  });

  await customer.save();
  return customer;
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerStatus,
  getCustomerDuties,
  addOrReplaceEquipment,
  checkStaffCustomerAccess,
};
