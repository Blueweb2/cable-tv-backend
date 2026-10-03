const mongoose = require("mongoose");

const requestItemSchema = new mongoose.Schema({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Material",
    required: [true, "Material is required"],
  },
  requestedQuantity: {
    type: Number,
    required: [true, "Requested quantity is required"],
    min: [0.001, "Requested quantity must be positive"],
  },
  approvedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  issuedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  usedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  returnedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "ISSUED",
      "PARTIALLY_RETURNED",
      "RETURNED",
      "COMPLETED",
    ],
    default: "PENDING",
  },
});

const materialRequestSchema = new mongoose.Schema(
  {
    duty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Duty",
      required: [true, "Duty work order is required"],
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Technician is required"],
    },
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    items: [requestItemSchema],
    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "ISSUED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "PENDING",
    },
    requestNotes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    approvalNotes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    issuedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

materialRequestSchema.index({ duty: 1 });
materialRequestSchema.index({ technician: 1 });
materialRequestSchema.index({ status: 1 });

module.exports = mongoose.model("MaterialRequest", materialRequestSchema);
