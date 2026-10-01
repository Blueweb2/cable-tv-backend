const Duty = require("../models/duty.model");
const User = require("../models/user.model");
const Zone = require("../models/zone.model");
const {
  sendDutyAssignmentNotification,
  sendDutyResponseNotificationToManager,
} = require("../utils/notification.util");

/**
 * Calculates duty duration in decimal hours and total payout amount
 */
const computeDutyHoursAndAmount = (startTime = "", endTime = "", hourlyRate = 0) => {
  if (!startTime || !endTime) {
    const rate = Math.max(0, Number(hourlyRate) || 0);
    return { totalHours: 0, totalAmount: 0, hourlyRate: rate };
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  if (isNaN(startH) || isNaN(endH)) {
    const rate = Math.max(0, Number(hourlyRate) || 0);
    return { totalHours: 0, totalAmount: 0, hourlyRate: rate };
  }

  let startMinutes = startH * 60 + (startM || 0);
  let endMinutes = endH * 60 + (endM || 0);

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Overnight shift
  }

  const diffMinutes = Math.max(0, endMinutes - startMinutes);
  const totalHours = Math.round((diffMinutes / 60) * 100) / 100;
  const rate = Math.max(0, Number(hourlyRate) || 0);
  const totalAmount = Math.round(totalHours * rate * 100) / 100;

  return { totalHours, totalAmount, hourlyRate: rate };
};

/**
 * Create a staff assignment / field duty
 */
const createAssignment = async ({
  zone = null,
  zoneName = "",
  nodeNumber = "",
  staff,
  dutyTitle,
  jobType = "GENERAL_SHIFT",
  priority = "MEDIUM",
  role = "Field Technician",
  department = "Field Operations",
  serviceName = "Cable Network Operations",
  description = "",
  location = "",
  siteLocation = null,
  problemDetails = null,
  subscriber = null,
  dutyDate,
  startTime,
  endTime,
  hourlyRate = 0,
  notes = "",
  checklist = [],
  tasks = [],
  assignedBy,
}) => {
  // CHECK STAFF
  const staffMember = await User.findOne({
    _id: staff,
    role: "staff",
    isActive: true,
  });

  if (!staffMember) {
    const error = new Error("Active staff / technician not found");
    error.statusCode = 404;
    throw error;
  }

  // Auto-fill zone name if zone ID provided
  let resolvedZoneName = zoneName;
  if (zone && !resolvedZoneName) {
    const zoneDoc = await Zone.findById(zone).select("name code");
    if (zoneDoc) {
      resolvedZoneName = `${zoneDoc.name} (${zoneDoc.code})`;
    }
  }

  // Calculate working hours & total salary for this shift
  const { totalHours, totalAmount, hourlyRate: rate } =
    computeDutyHoursAndAmount(startTime, endTime, hourlyRate);

  // Normalize checklist
  const normalizedChecklist = (checklist || []).map((item) => {
    if (typeof item === "string") return { text: item, completed: false };
    return { text: item.text || item.title || "", completed: Boolean(item.completed) };
  });

  // Construct Google Maps URL if coordinates provided and no URL
  let resolvedSiteLocation = siteLocation || {};
  if (resolvedSiteLocation.coordinates?.lat && resolvedSiteLocation.coordinates?.lng && !resolvedSiteLocation.googleMapsUrl) {
    resolvedSiteLocation.googleMapsUrl = `https://www.google.com/maps?q=${resolvedSiteLocation.coordinates.lat},${resolvedSiteLocation.coordinates.lng}`;
  }

  const duty = await Duty.create({
    zone: zone || null,
    zoneName: resolvedZoneName,
    nodeNumber,
    staff,
    dutyTitle,
    jobType,
    priority,
    role: role || staffMember.department || "Field Technician",
    department: department || staffMember.department || "Field Operations",
    serviceName,
    description,
    location: location || resolvedSiteLocation.address || resolvedZoneName,
    siteLocation: resolvedSiteLocation,
    problemDetails: problemDetails || undefined,
    subscriber: subscriber || undefined,
    dutyDate: new Date(dutyDate),
    startTime,
    endTime,
    hourlyRate: rate,
    totalHours,
    totalAmount,
    notes,
    checklist: normalizedChecklist,
    tasks: tasks || [],
    assignedBy,
    status: "ASSIGNED",
  });

  const populatedDuty = await Duty.findById(duty._id)
    .populate("staff", "name email phone department location")
    .populate("assignedBy", "name email phone")
    .populate("zone", "name code zoneType coverageArea");

  try {
    sendDutyAssignmentNotification(populatedDuty);
  } catch (err) {
    console.error("Failed to send assignment notification:", err.message);
  }

  return populatedDuty;
};

/**
 * Get all assignments with filters
 */
const getAssignments = async ({
  staff,
  zone,
  status,
  priority,
  jobType,
  startDate,
  endDate,
  dutyDate,
  department,
  search,
  page = 1,
  limit = 50,
} = {}) => {
  const query = {};

  if (staff) query.staff = staff;
  if (zone) query.zone = zone;
  if (status && status !== "ALL") query.status = status;
  if (priority && priority !== "ALL") query.priority = priority;
  if (jobType && jobType !== "ALL") query.jobType = jobType;
  if (department && department !== "ALL") query.department = department;

  if (dutyDate) {
    const d = new Date(dutyDate);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = new Date(d.setHours(23, 59, 59, 999));
    query.dutyDate = { $gte: startOfDay, $lte: endOfDay };
  } else if (startDate || endDate) {
    query.dutyDate = {};
    if (startDate) query.dutyDate.$gte = new Date(startDate);
    if (endDate) query.dutyDate.$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { dutyTitle: { $regex: search, $options: "i" } },
      { zoneName: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { "siteLocation.address": { $regex: search, $options: "i" } },
      { "siteLocation.poleNumber": { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { "subscriber.name": { $regex: search, $options: "i" } },
      { "subscriber.phone": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Duty.countDocuments(query);

  const assignments = await Duty.find(query)
    .populate("staff", "name email phone department location")
    .populate("assignedBy", "name email phone")
    .populate("zone", "name code zoneType coverageArea")
    .populate("sitePhotos.uploadedBy", "name")
    .sort({ dutyDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return {
    assignments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get duty / assignment by ID
 */
const getAssignmentById = async (id) => {
  const duty = await Duty.findById(id)
    .populate("staff", "name email phone department location")
    .populate("assignedBy", "name email phone")
    .populate("zone", "name code zoneType coverageArea")
    .populate("sitePhotos.uploadedBy", "name")
    .lean();

  if (!duty) {
    const error = new Error("Field duty not found");
    error.statusCode = 404;
    throw error;
  }

  return duty;
};

/**
 * Update assignment by Manager
 */
const updateAssignment = async (id, updateData) => {
  if (updateData.startTime || updateData.endTime || updateData.hourlyRate !== undefined) {
    const existing = await Duty.findById(id);
    if (existing) {
      const sTime = updateData.startTime || existing.startTime;
      const eTime = updateData.endTime || existing.endTime;
      const hRate = updateData.hourlyRate !== undefined ? updateData.hourlyRate : existing.hourlyRate;
      const { totalHours, totalAmount, hourlyRate: rate } = computeDutyHoursAndAmount(sTime, eTime, hRate);
      updateData.totalHours = totalHours;
      updateData.totalAmount = totalAmount;
      updateData.hourlyRate = rate;
    }
  }

  const updated = await Duty.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("staff", "name email phone department location")
    .populate("assignedBy", "name email phone")
    .populate("zone", "name code zoneType coverageArea")
    .populate("sitePhotos.uploadedBy", "name");

  if (!updated) {
    const error = new Error("Field duty not found");
    error.statusCode = 404;
    throw error;
  }

  return updated;
};

/**
 * Staff add site photo proof
 */
const addSitePhoto = async (dutyId, staffId, { url, caption = "", photoType = "AFTER_WORK" }) => {
  const duty = await Duty.findById(dutyId);
  if (!duty) {
    const error = new Error("Duty not found");
    error.statusCode = 404;
    throw error;
  }

  duty.sitePhotos.push({
    url,
    caption,
    photoType,
    uploadedAt: new Date(),
    uploadedBy: staffId,
  });

  await duty.save();

  return Duty.findById(duty._id)
    .populate("staff", "name email phone")
    .populate("sitePhotos.uploadedBy", "name");
};

/**
 * Delete site photo
 */
const deleteSitePhoto = async (dutyId, photoId) => {
  const duty = await Duty.findById(dutyId);
  if (!duty) {
    const error = new Error("Duty not found");
    error.statusCode = 404;
    throw error;
  }

  duty.sitePhotos = duty.sitePhotos.filter((p) => p._id.toString() !== photoId.toString());
  await duty.save();
  return duty;
};

/**
 * Staff respond to assignment (ACCEPT or REJECT)
 */
const respondToAssignment = async (id, staffId, { response, rejectionReason = "" }) => {
  const duty = await Duty.findOne({ _id: id, staff: staffId });

  if (!duty) {
    const error = new Error("Duty not found or not assigned to you");
    error.statusCode = 404;
    throw error;
  }

  if (response === "ACCEPT") {
    duty.status = "ACCEPTED";
  } else if (response === "REJECT") {
    duty.status = "REJECTED";
    duty.rejectionReason = rejectionReason;
  } else {
    const error = new Error("Invalid response. Must be ACCEPT or REJECT");
    error.statusCode = 400;
    throw error;
  }

  duty.respondedAt = new Date();
  await duty.save();

  const populatedDuty = await Duty.findById(duty._id)
    .populate("staff", "name email phone")
    .populate("assignedBy", "name email phone")
    .populate("zone", "name code");

  try {
    sendDutyResponseNotificationToManager(populatedDuty, response);
  } catch (err) {
    console.error("Failed to send response notification:", err.message);
  }

  return populatedDuty;
};

/**
 * Staff update checklist item
 */
const toggleChecklistItem = async (dutyId, staffId, itemIndex, completed) => {
  const duty = await Duty.findOne({ _id: dutyId, staff: staffId });
  if (!duty) {
    const error = new Error("Duty not found or not assigned to you");
    error.statusCode = 404;
    throw error;
  }

  if (!duty.checklist || !duty.checklist[itemIndex]) {
    const error = new Error("Checklist item not found");
    error.statusCode = 404;
    throw error;
  }

  duty.checklist[itemIndex].completed = completed;

  // Auto transition to IN_PROGRESS if at least one item checked
  if (duty.status === "ASSIGNED" || duty.status === "ACCEPTED") {
    duty.status = "IN_PROGRESS";
  }

  await duty.save();
  return duty;
};

/**
 * Staff complete duty with resolution notes & optical power measurement
 */
const completeDuty = async (dutyId, staffId, { resolutionSummary = "", notes = "", finalOpticalPowerDbm = "" }) => {
  const duty = await Duty.findOne({ _id: dutyId, staff: staffId });
  if (!duty) {
    const error = new Error("Duty not found or not assigned to you");
    error.statusCode = 404;
    throw error;
  }

  duty.status = "COMPLETED";
  if (resolutionSummary) duty.resolutionSummary = resolutionSummary;
  if (notes) duty.notes = notes;
  if (finalOpticalPowerDbm) duty.finalOpticalPowerDbm = finalOpticalPowerDbm;

  // Mark all checklist items as completed
  if (duty.checklist && duty.checklist.length > 0) {
    duty.checklist.forEach((item) => {
      item.completed = true;
    });
  }

  await duty.save();
  return duty;
};

/**
 * Delete assignment
 */
const deleteAssignment = async (id) => {
  const duty = await Duty.findByIdAndDelete(id);
  if (!duty) {
    const error = new Error("Field duty not found");
    error.statusCode = 404;
    throw error;
  }
  return { message: "Field duty removed successfully" };
};

module.exports = {
  computeDutyHoursAndAmount,
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  addSitePhoto,
  deleteSitePhoto,
  respondToAssignment,
  toggleChecklistItem,
  completeDuty,
  deleteAssignment,
};