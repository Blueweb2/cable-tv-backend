const Duty = require("../models/duty.model");
const User = require("../models/user.model");
const Zone = require("../models/zone.model");
const Availability = require("../models/availability.model");
const { mapJobTypeToTechnicianRole } = require("./department.service");
const {
  sendDutyAssignmentNotification,
  sendDutyResponseNotificationToManager,
} = require("../utils/notification.util");
const {
  emitDutyAssigned,
  emitDutyReassigned,
  emitDutyStatusChanged,
  emitDutyCancelled,
} = require("../socket");

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
 * Validates staff eligibility (must exist, must have role 'staff', must be active, must not be on leave)
 */
const validateStaffEligibility = async (staffId, dutyDate) => {
  const staffMember = await User.findById(staffId);
  if (!staffMember) {
    const error = new Error("Selected technician not found");
    error.statusCode = 404;
    throw error;
  }

  if (staffMember.role !== "staff") {
    const error = new Error("Selected user is not a field staff member.");
    error.statusCode = 400;
    throw error;
  }

  if (!staffMember.isActive) {
    const error = new Error("Selected technician is inactive.");
    error.statusCode = 400;
    throw error;
  }

  if (dutyDate) {
    const targetDay = new Date(dutyDate);
    const startOfDay = new Date(targetDay.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDay.setHours(23, 59, 59, 999));

    const avail = await Availability.findOne({
      staff: staffId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (avail && (avail.status === "ON_LEAVE" || avail.status === "UNAVAILABLE")) {
      const error = new Error(
        `Selected technician is unavailable on this date (${avail.status}).`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return staffMember;
};

/**
 * Create a staff assignment / field duty
 */
const createAssignment = async ({
  zone = null,
  zoneName = "",
  nodeNumber = "",
  staff,
  assignedStaff = [],
  specializationRequired = "",
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
  // Validate primary technician
  const staffMember = await validateStaffEligibility(staff, dutyDate);

  // Validate multi-staff / team members if provided
  let teamStaffIds = [staffMember._id];
  if (Array.isArray(assignedStaff) && assignedStaff.length > 0) {
    for (const memberId of assignedStaff) {
      if (memberId && memberId.toString() !== staffMember._id.toString()) {
        const teamMember = await validateStaffEligibility(memberId, dutyDate);
        teamStaffIds.push(teamMember._id);
      }
    }
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

  // Inferred specialization if not provided
  const inferred = mapJobTypeToTechnicianRole(jobType, serviceName);
  const resolvedSpec = specializationRequired || inferred.specialization || staffMember.specialization || "Field Technician";

  const duty = await Duty.create({
    zone: zone || null,
    zoneName: resolvedZoneName,
    nodeNumber,
    staff: staffMember._id,
    assignedStaff: teamStaffIds,
    specializationRequired: resolvedSpec,
    dutyTitle,
    jobType,
    priority,
    role: role || staffMember.specialization || staffMember.department || "Field Technician",
    department: department || staffMember.department || inferred.department || "Field Operations",
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
    .populate("staff", "name email phone department specialization location employeeId")
    .populate("assignedStaff", "name email phone department specialization location employeeId")
    .populate("assignedBy", "name email phone")
    .populate("zone", "name code zoneType coverageArea");

  try {
    sendDutyAssignmentNotification(populatedDuty);
    emitDutyAssigned(populatedDuty);
  } catch (err) {
    console.error("Failed to send assignment notification / realtime event:", err.message);
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

  if (staff) {
    query.$or = [{ staff }, { assignedStaff: staff }];
  }
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
    const searchFilter = [
      { dutyTitle: { $regex: search, $options: "i" } },
      { zoneName: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { "siteLocation.address": { $regex: search, $options: "i" } },
      { "siteLocation.poleNumber": { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { "subscriber.name": { $regex: search, $options: "i" } },
      { "subscriber.phone": { $regex: search, $options: "i" } },
    ];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchFilter }];
      delete query.$or;
    } else {
      query.$or = searchFilter;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Duty.countDocuments(query);

  const assignments = await Duty.find(query)
    .populate("staff", "name email phone department specialization location employeeId")
    .populate("assignedStaff", "name email phone department specialization location employeeId")
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
    .populate("staff", "name email phone department specialization location employeeId")
    .populate("assignedStaff", "name email phone department specialization location employeeId")
    .populate("assignmentHistory.previousStaff", "name email phone specialization employeeId")
    .populate("assignmentHistory.newStaff", "name email phone specialization employeeId")
    .populate("assignmentHistory.reassignedBy", "name email phone")
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
 * Update assignment by Manager (Supports Reassignment, multi-staff, cancellation)
 */
const updateAssignment = async (id, updateData) => {
  const existing = await Duty.findById(id);
  if (!existing) {
    const error = new Error("Field duty not found");
    error.statusCode = 404;
    throw error;
  }

  let isReassignment = false;
  let oldStaffId = null;
  let reassignmentEntry = null;

  // If staff is being updated / reassigned
  if (updateData.staff && updateData.staff.toString() !== existing.staff.toString()) {
    const newStaff = await validateStaffEligibility(
      updateData.staff,
      updateData.dutyDate || existing.dutyDate
    );
    isReassignment = true;
    oldStaffId = existing.staff.toString();
    updateData.staff = newStaff._id;

    reassignmentEntry = {
      previousStaff: existing.staff,
      newStaff: newStaff._id,
      reassignedBy: updateData.reassignedBy || updateData.assignedBy || null,
      reassignedAt: new Date(),
      reason: updateData.reassignmentReason || updateData.notes || "Manager Reassignment",
    };

    // Update assignedStaff team array
    if (Array.isArray(updateData.assignedStaff)) {
      updateData.assignedStaff = Array.from(
        new Set([newStaff._id.toString(), ...updateData.assignedStaff.map(String)])
      );
    } else {
      updateData.assignedStaff = [newStaff._id];
    }
  }

  if (updateData.startTime || updateData.endTime || updateData.hourlyRate !== undefined) {
    const sTime = updateData.startTime || existing.startTime;
    const eTime = updateData.endTime || existing.endTime;
    const hRate = updateData.hourlyRate !== undefined ? updateData.hourlyRate : existing.hourlyRate;
    const { totalHours, totalAmount, hourlyRate: rate } = computeDutyHoursAndAmount(sTime, eTime, hRate);
    updateData.totalHours = totalHours;
    updateData.totalAmount = totalAmount;
    updateData.hourlyRate = rate;
  }

  const updateOps = { $set: updateData };
  if (reassignmentEntry) {
    updateOps.$push = { assignmentHistory: reassignmentEntry };
  }

  const updated = await Duty.findByIdAndUpdate(id, updateOps, {
    new: true,
    runValidators: true,
  })
    .populate("staff", "name email phone department specialization location employeeId")
    .populate("assignedStaff", "name email phone department specialization location employeeId")
    .populate("assignmentHistory.previousStaff", "name email phone specialization employeeId")
    .populate("assignmentHistory.newStaff", "name email phone specialization employeeId")
    .populate("assignmentHistory.reassignedBy", "name email phone")
    .populate("assignedBy", "name email phone")
    .populate("zone", "name code zoneType coverageArea")
    .populate("sitePhotos.uploadedBy", "name");

  try {
    if (isReassignment) {
      emitDutyReassigned(updated, oldStaffId);
      sendDutyAssignmentNotification(updated);
    } else if (updateData.status === "CANCELLED") {
      emitDutyCancelled(updated);
    } else {
      emitDutyStatusChanged(updated);
    }
  } catch (err) {
    console.error("Failed to emit socket updates on duty edit:", err.message);
  }

  return updated;
};

/**
 * Staff add site photo proof
 */
const addSitePhoto = async (dutyId, staffId, userRole = "staff", { url, caption = "", photoType = "AFTER_WORK" }) => {
  const duty = await Duty.findById(dutyId);
  if (!duty) {
    const error = new Error("Duty not found");
    error.statusCode = 404;
    throw error;
  }

  const role = (userRole || "").toLowerCase();
  if (role === "staff") {
    const isPrimaryStaff = duty.staff?.toString() === staffId.toString();
    const isTeamMember = Array.isArray(duty.assignedStaff) &&
      duty.assignedStaff.some((s) => s?.toString() === staffId.toString());

    if (!isPrimaryStaff && !isTeamMember) {
      const error = new Error("You can only upload site photos for your assigned field duty");
      error.statusCode = 403;
      throw error;
    }
  }

  duty.sitePhotos.push({
    url,
    caption,
    photoType,
    uploadedAt: new Date(),
    uploadedBy: staffId,
  });

  await duty.save();

  const populated = await Duty.findById(duty._id)
    .populate("staff", "name email phone")
    .populate("sitePhotos.uploadedBy", "name");

  try {
    emitDutyStatusChanged(populated);
  } catch (err) {
    console.error("Socket error on site photo:", err.message);
  }

  return populated;
};

/**
 * Delete site photo
 */
const deleteSitePhoto = async (dutyId, photoId, userId, userRole = "staff") => {
  const duty = await Duty.findById(dutyId);
  if (!duty) {
    const error = new Error("Duty not found");
    error.statusCode = 404;
    throw error;
  }

  const photo = duty.sitePhotos.find((p) => p._id.toString() === photoId.toString());
  if (!photo) {
    const error = new Error("Site photo not found");
    error.statusCode = 404;
    throw error;
  }

  const role = (userRole || "").toLowerCase();
  if (role === "staff") {
    const uploaderId = photo.uploadedBy?.toString();
    const dutyStaffId = duty.staff?.toString();
    if (uploaderId !== userId?.toString() && dutyStaffId !== userId?.toString()) {
      const error = new Error("You do not have permission to remove this photo");
      error.statusCode = 403;
      throw error;
    }
  }

  duty.sitePhotos = duty.sitePhotos.filter((p) => p._id.toString() !== photoId.toString());
  await duty.save();
  return duty;
};

/**
 * Staff respond to assignment (ACCEPT or REJECT)
 */
const respondToAssignment = async (id, staffId, { response, rejectionReason = "" }) => {
  const duty = await Duty.findOne({
    _id: id,
    $or: [{ staff: staffId }, { assignedStaff: staffId }],
  });

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
    emitDutyStatusChanged(populatedDuty);
  } catch (err) {
    console.error("Failed to send response notification / socket event:", err.message);
  }

  return populatedDuty;
};

/**
 * Staff update checklist item
 */
const toggleChecklistItem = async (dutyId, staffId, itemIndex, completed) => {
  const duty = await Duty.findOne({
    _id: dutyId,
    $or: [{ staff: staffId }, { assignedStaff: staffId }],
  });
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

  try {
    emitDutyStatusChanged(duty);
  } catch (err) {
    console.error("Socket error on checklist toggle:", err.message);
  }

  return duty;
};

/**
 * Staff complete duty with resolution notes & optical power measurement
 */
const completeDuty = async (dutyId, staffId, { resolutionSummary = "", notes = "", finalOpticalPowerDbm = "" }) => {
  const duty = await Duty.findOne({
    _id: dutyId,
    $or: [{ staff: staffId }, { assignedStaff: staffId }],
  });
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

  const populated = await Duty.findById(duty._id)
    .populate("staff", "name email phone")
    .populate("zone", "name code");

  try {
    emitDutyStatusChanged(populated);
  } catch (err) {
    console.error("Socket error on complete duty:", err.message);
  }

  return populated;
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

  try {
    emitDutyCancelled(duty);
  } catch (err) {
    console.error("Socket error on delete assignment:", err.message);
  }

  return { message: "Field duty removed successfully" };
};

module.exports = {
  computeDutyHoursAndAmount,
  validateStaffEligibility,
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