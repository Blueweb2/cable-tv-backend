const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Zone name is required"],
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: [true, "Zone code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    zoneType: {
      type: String,
      enum: ["FIBER_FTTH", "COAXIAL_GRID", "HYBRID_HFC", "COMMERCIAL_HUB", "RESIDENTIAL_SECTOR"],
      default: "FIBER_FTTH",
    },
    coverageArea: {
      type: String,
      required: [true, "Coverage area description is required"],
      trim: true,
      maxlength: 300,
    },
    totalSubscribers: {
      type: Number,
      default: 0,
      min: [0, "Total subscribers cannot be negative"],
    },
    nodes: [
      {
        nodeNumber: { type: String, required: true, trim: true },
        location: { type: String, trim: true, default: "" },
        opticalPowerDbm: { type: String, trim: true, default: "-18 dBm" },
        status: {
          type: String,
          enum: ["HEALTHY", "WARNING", "CRITICAL", "OFFLINE"],
          default: "HEALTHY",
        },
        amplifierCount: { type: Number, default: 2 },
      },
    ],
    assignedLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedStaff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["OPERATIONAL", "MAINTENANCE", "DEGRADED", "OUTAGE"],
      default: "OPERATIONAL",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

zoneSchema.index({ status: 1 });
zoneSchema.index({ assignedLead: 1 });

module.exports = mongoose.model("Zone", zoneSchema);
