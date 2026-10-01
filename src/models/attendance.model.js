const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    // Staff / Technician
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Staff member is required"],
    },

    // Specific Duty / Work Order (optional - can be general shift punch)
    duty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Duty",
      default: null,
    },

    // Specific Zone (optional)
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },

    date: {
      type: Date,
      required: [true, "Attendance date is required"],
    },

    checkIn: {
      type: Date,
      default: null,
    },

    checkOut: {
      type: Date,
      default: null,
    },

    isPaused: {
      type: Boolean,
      default: false,
    },

    pausedAt: {
      type: Date,
      default: null,
    },

    totalPauseMinutes: {
      type: Number,
      default: 0,
    },

    activeMinutes: {
      type: Number,
      default: 0,
    },

    totalHours: {
      type: Number,
      default: 0,
    },

    locationCheckIn: {
      type: String,
      trim: true,
      default: "",
    },

    locationCheckOut: {
      type: String,
      trim: true,
      default: "",
    },

    sessions: [
      {
        type: {
          type: String,
          enum: ["CLOCK_IN", "PAUSE", "RESUME", "CLOCK_OUT"],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: "",
        },
        notes: {
          type: String,
          default: "",
        },
      },
    ],

    pauseHistory: [
      {
        pausedAt: Date,
        resumedAt: Date,
        durationMinutes: Number,
        reason: String,
      },
    ],

    status: {
      type: String,
      enum: ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE"],
      default: "PRESENT",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({
  staff: 1,
  date: 1,
});

attendanceSchema.index({
  duty: 1,
});

module.exports = mongoose.model("Attendance", attendanceSchema);