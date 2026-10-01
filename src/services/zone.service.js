const Zone = require("../models/zone.model");
const Duty = require("../models/duty.model");
const User = require("../models/user.model");

/**
 * Get all zones with optional status and search filters
 */
const getAllZones = async ({ search = "", status = "", page = 1, limit = 50 } = {}) => {
  const query = {};

  if (status && status !== "ALL") {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { coverageArea: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Zone.countDocuments(query);

  const zones = await Zone.find(query)
    .populate("assignedLead", "name email phone location role")
    .populate("assignedStaff", "name email phone department role")
    .sort({ name: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  // Attach live duty statistics to each zone
  const zoneIds = zones.map((z) => z._id);
  const activeDuties = await Duty.find({
    zone: { $in: zoneIds },
    status: { $in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
  }).select("zone status priority");

  const enrichedZones = zones.map((zone) => {
    const zoneDuties = activeDuties.filter(
      (d) => d.zone && d.zone.toString() === zone._id.toString()
    );
    const criticalCount = zoneDuties.filter((d) => d.priority === "CRITICAL_OUTAGE").length;
    return {
      ...zone,
      activeDutiesCount: zoneDuties.length,
      criticalAlertsCount: criticalCount,
    };
  });

  return {
    zones: enrichedZones,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get single zone by ID
 */
const getZoneById = async (id) => {
  const zone = await Zone.findById(id)
    .populate("assignedLead", "name email phone location")
    .populate("assignedStaff", "name email phone department")
    .lean();

  if (!zone) {
    const error = new Error("Zone not found");
    error.statusCode = 404;
    throw error;
  }

  const duties = await Duty.find({ zone: id })
    .populate("staff", "name email phone")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return {
    ...zone,
    recentDuties: duties,
  };
};

/**
 * Create a new Zone
 */
const createZone = async (zoneData) => {
  const existingCode = await Zone.findOne({ code: zoneData.code?.toUpperCase() });
  if (existingCode) {
    const error = new Error(`Zone code '${zoneData.code}' already exists`);
    error.statusCode = 400;
    throw error;
  }

  const newZone = await Zone.create({
    ...zoneData,
    code: zoneData.code?.toUpperCase(),
  });

  return Zone.findById(newZone._id)
    .populate("assignedLead", "name email phone")
    .populate("assignedStaff", "name email phone");
};

/**
 * Update an existing Zone
 */
const updateZone = async (id, updateData) => {
  if (updateData.code) {
    const existingCode = await Zone.findOne({
      code: updateData.code.toUpperCase(),
      _id: { $ne: id },
    });
    if (existingCode) {
      const error = new Error(`Zone code '${updateData.code}' already exists`);
      error.statusCode = 400;
      throw error;
    }
    updateData.code = updateData.code.toUpperCase();
  }

  const updatedZone = await Zone.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("assignedLead", "name email phone")
    .populate("assignedStaff", "name email phone");

  if (!updatedZone) {
    const error = new Error("Zone not found");
    error.statusCode = 404;
    throw error;
  }

  return updatedZone;
};

/**
 * Delete a Zone
 */
const deleteZone = async (id) => {
  const zone = await Zone.findByIdAndDelete(id);
  if (!zone) {
    const error = new Error("Zone not found");
    error.statusCode = 404;
    throw error;
  }
  return { message: "Zone deleted successfully" };
};

/**
 * Assign staff/technicians to a zone
 */
const assignTechniciansToZone = async (zoneId, { leadId, staffIds = [] }) => {
  const updatePayload = {};
  if (leadId !== undefined) {
    updatePayload.assignedLead = leadId || null;
  }
  if (Array.isArray(staffIds)) {
    updatePayload.assignedStaff = staffIds;
  }

  return updateZone(zoneId, updatePayload);
};

module.exports = {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  assignTechniciansToZone,
};
