const assignmentService = require("../services/assignment.service");

/**
 * Create assignment / Field Job
 * POST /api/assignments
 */
const createAssignment = async (req, res, next) => {
  try {
    const {
      zone,
      zoneName,
      nodeNumber,
      staff,
      dutyTitle,
      jobType,
      priority,
      role,
      department,
      serviceName,
      description,
      location,
      siteLocation,
      problemDetails,
      subscriber,
      dutyDate,
      startTime,
      endTime,
      hourlyRate,
      notes,
      checklist,
      tasks,
    } = req.body;

    if (!staff || !dutyTitle || !dutyDate || !startTime || !endTime) {
      const error = new Error(
        "Staff, duty title, date, start time and end time are required"
      );
      error.statusCode = 400;
      throw error;
    }

    const assignment = await assignmentService.createAssignment({
      zone,
      zoneName,
      nodeNumber,
      staff,
      dutyTitle,
      jobType,
      priority,
      role,
      department,
      serviceName,
      description,
      location,
      siteLocation,
      problemDetails,
      subscriber,
      dutyDate,
      startTime,
      endTime,
      hourlyRate,
      notes,
      checklist,
      tasks,
      assignedBy: req.user.userId,
    });

    res.status(201).json({
      success: true,
      message: "Field duty assigned successfully",
      data: {
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get assignments / duties
 * GET /api/assignments
 */
const getAssignments = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    const role = (req.user?.role || "").toLowerCase();

    if (role === "staff") {
      filters.staff = req.user.userId;
    }

    const result = await assignmentService.getAssignments(filters);

    res.status(200).json({
      success: true,
      data: result.assignments,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single assignment
 * GET /api/assignments/:id
 */
const getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await assignmentService.getAssignmentById(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update assignment
 * PUT /api/assignments/:id
 */
const updateAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.updateAssignment(
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Field duty updated successfully",
      data: {
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel/Delete assignment
 * DELETE /api/assignments/:id
 */
const deleteAssignment = async (req, res, next) => {
  try {
    const result = await assignmentService.deleteAssignment(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Site Photo Proof
 * POST /api/assignments/:id/photos
 */
const uploadSitePhoto = async (req, res, next) => {
  try {
    const dutyId = req.params.id;
    const { caption, photoType } = req.body;

    let photoUrl = req.body.url;
    if (req.file) {
      photoUrl = `/uploads/site-photos/${req.file.filename}`;
    }

    if (!photoUrl) {
      const error = new Error("Photo image file or URL is required");
      error.statusCode = 400;
      throw error;
    }

    const duty = await assignmentService.addSitePhoto(dutyId, req.user.userId, {
      url: photoUrl,
      caption: caption || "",
      photoType: photoType || "AFTER_WORK",
    });

    res.status(201).json({
      success: true,
      message: "Site photo uploaded successfully",
      data: {
        duty,
        photo: duty.sitePhotos[duty.sitePhotos.length - 1],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Site Photo
 * DELETE /api/assignments/:id/photos/:photoId
 */
const deleteSitePhoto = async (req, res, next) => {
  try {
    const { id, photoId } = req.params;
    const duty = await assignmentService.deleteSitePhoto(id, photoId);

    res.status(200).json({
      success: true,
      message: "Site photo removed",
      data: { duty },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept assignment
 * PATCH /api/assignments/:id/accept
 */
const acceptAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.respondToAssignment(
      req.params.id,
      req.user.userId,
      { response: "ACCEPT" }
    );

    res.status(200).json({
      success: true,
      message: "Field duty accepted successfully",
      data: {
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject assignment
 * PATCH /api/assignments/:id/reject
 */
const rejectAssignment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const assignment = await assignmentService.respondToAssignment(
      req.params.id,
      req.user.userId,
      { response: "REJECT", rejectionReason: reason }
    );

    res.status(200).json({
      success: true,
      message: "Field duty declined successfully",
      data: {
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle checklist item
 * PATCH /api/assignments/:id/checklist/toggle
 */
const toggleChecklist = async (req, res, next) => {
  try {
    const { itemIndex, completed } = req.body;
    const duty = await assignmentService.toggleChecklistItem(
      req.params.id,
      req.user.userId,
      itemIndex,
      completed
    );

    res.status(200).json({
      success: true,
      message: "Checklist updated",
      data: { assignment: duty },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete field duty
 * PATCH /api/assignments/:id/complete
 */
const completeDuty = async (req, res, next) => {
  try {
    const { resolutionSummary, notes, finalOpticalPowerDbm } = req.body;
    const duty = await assignmentService.completeDuty(
      req.params.id,
      req.user.userId,
      { resolutionSummary, notes, finalOpticalPowerDbm }
    );

    res.status(200).json({
      success: true,
      message: "Field duty marked as completed",
      data: { assignment: duty },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  uploadSitePhoto,
  deleteSitePhoto,
  acceptAssignment,
  rejectAssignment,
  toggleChecklist,
  completeDuty,
};