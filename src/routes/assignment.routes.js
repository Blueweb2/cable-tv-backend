const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignment.controller");
const upload = require("../middlewares/upload.middleware");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect);

router
  .route("/")
  .get(assignmentController.getAssignments)
  .post(
    restrictTo("admin", "manager"),
    assignmentController.createAssignment
  );

router
  .route("/:id")
  .get(assignmentController.getAssignmentById)
  .put(
    restrictTo("admin", "manager"),
    assignmentController.updateAssignment
  )
  .delete(
    restrictTo("admin", "manager"),
    assignmentController.deleteAssignment
  );

// Site Photo Uploads
router.post(
  "/:id/photos",
  upload.single("photo"),
  assignmentController.uploadSitePhoto
);
router.delete(
  "/:id/photos/:photoId",
  assignmentController.deleteSitePhoto
);

router.patch("/:id/accept", assignmentController.acceptAssignment);
router.patch("/:id/reject", assignmentController.rejectAssignment);
router.patch("/:id/checklist/toggle", assignmentController.toggleChecklist);
router.patch("/:id/complete", assignmentController.completeDuty);

module.exports = router;