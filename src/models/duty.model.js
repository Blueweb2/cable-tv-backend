const mongoose = require("mongoose");

const dutySchema = new mongoose.Schema(
  {
    // Cable Operator Network Zone
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },

    zoneName: {
      type: String,
      trim: true,
      default: "",
    },

    nodeNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // Assigned lead technician / staff member
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Staff / Technician member is required"],
    },

    // Multi-staff team members for field work
    assignedStaff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Required technician specialization (e.g. Fiber Technician, Linesman)
    specializationRequired: {
      type: String,
      trim: true,
      default: "",
    },

    // Work order / Duty Title
    dutyTitle: {
      type: String,
      required: [true, "Duty / Work order title is required"],
      trim: true,
      minlength: 2,
      maxlength: 200,
    },

    // Job category / Type
    jobType: {
      type: String,
      enum: [
        "FIBER_SPLICING",
        "LINE_REPAIR",
        "NEW_INSTALLATION",
        "NODE_MAINTENANCE",
        "SIGNAL_OPTIMIZATION",
        "COMPLAINT_RESOLUTION",
        "PAYMENT_COLLECTION",
        "FIELD_PATROL",
        "GENERAL_SHIFT",
      ],
      default: "GENERAL_SHIFT",
    },

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL_OUTAGE"],
      default: "MEDIUM",
    },

    // Detailed Site Location & GPS Navigation
    siteLocation: {
      address: { type: String, trim: true, default: "" },
      landmark: { type: String, trim: true, default: "" },
      poleNumber: { type: String, trim: true, default: "" },
      distributionBox: { type: String, trim: true, default: "" },
      googleMapsUrl: { type: String, trim: true, default: "" },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

    // Problem Diagnostics & Fault Breakdown
    problemDetails: {
      issueCategory: {
        type: String,
        trim: true,
        default: "Network Disruption",
      },
      faultDescription: {
        type: String,
        trim: true,
        default: "",
      },
      affectedSubscribersCount: {
        type: Number,
        default: 1,
      },
      reportedBy: {
        type: String,
        trim: true,
        default: "NOC Dispatcher",
      },
      reportedPhone: {
        type: String,
        trim: true,
        default: "",
      },
      initialOpticalPowerDbm: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // Staff Site Photos (Proof of work, pole damage, before & after splice, OTDR meter reading)
    sitePhotos: [
      {
        url: { type: String, required: true },
        caption: { type: String, trim: true, default: "" },
        photoType: {
          type: String,
          enum: ["BEFORE_WORK", "IN_PROGRESS", "AFTER_WORK", "DAMAGE_EVIDENCE", "METER_READING", "OTHER"],
          default: "AFTER_WORK",
        },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
    ],

    // Technician role during shift
    role: {
      type: String,
      trim: true,
      default: "Field Technician",
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1500,
    },

    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },

    // Subscriber details if this duty is a subscriber complaint or installation
    subscriber: {
      name: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      accountNo: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
    },

    dutyDate: {
      type: Date,
      required: [true, "Duty date is required"],
    },

    startTime: {
      type: String,
      required: [true, "Start time is required"],
      trim: true,
    },

    endTime: {
      type: String,
      required: [true, "End time is required"],
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "ASSIGNED",
        "ACCEPTED",
        "REJECTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "ASSIGNED",
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    department: {
      type: String,
      trim: true,
      default: "Field Operations",
      maxlength: 100,
    },

    serviceName: {
      type: String,
      trim: true,
      default: "Cable Network Maintenance",
      maxlength: 150,
    },

    respondedAt: {
      type: Date,
      default: null,
    },

    hourlyRate: {
      type: Number,
      default: 0,
      min: [0, "Salary/Rate cannot be negative"],
    },

    totalHours: {
      type: Number,
      default: 0,
      min: [0, "Total hours cannot be negative"],
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: [0, "Total amount cannot be negative"],
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "PROCESSING"],
      default: "PENDING",
    },

    paidAt: {
      type: Date,
      default: null,
    },

    paymentReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    resolutionSummary: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    finalOpticalPowerDbm: {
      type: String,
      trim: true,
      default: "",
    },

    // Checklist of tasks for field completion
    checklist: [
      {
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
      },
    ],

    tasks: [
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: "" },
        plannedStartAt: { type: Date, default: null },
        plannedEndAt: { type: Date, default: null },
        actualStartAt: { type: Date, default: null },
        actualEndAt: { type: Date, default: null },
        status: {
          type: String,
          enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "SKIPPED"],
          default: "PENDING",
        },
        completionNotes: { type: String, trim: true, default: "" },
      },
    ],

    // Reassignment and dispatch history audit log
    assignmentHistory: [
      {
        previousStaff: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        newStaff: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reassignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reassignedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],

    // Manager/Dispatcher who assigned this duty
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned by is required"],
    },
  },
  {
    timestamps: true,
  }
);

dutySchema.index({
  staff: 1,
  dutyDate: 1,
});

dutySchema.index({
  assignedStaff: 1,
  dutyDate: 1,
});

dutySchema.index({
  zone: 1,
  status: 1,
});

dutySchema.index({
  dutyDate: 1,
  status: 1,
});

dutySchema.index({
  priority: 1,
  status: 1,
});

module.exports = mongoose.model("Duty", dutySchema);