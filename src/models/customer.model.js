const mongoose = require("mongoose");

const networkEquipmentSchema = new mongoose.Schema(
  {
    equipmentType: {
      type: String,
      enum: ["ONU", "ONT", "Router", "STB", "Modem", "Other"],
      required: true,
      default: "ONU",
    },
    serialNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    macAddress: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    model: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "FAULTY", "REPLACED", "RETURNED"],
      default: "ACTIVE",
    },
    installationDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true, timestamps: true }
);

const equipmentHistorySchema = new mongoose.Schema(
  {
    equipmentType: {
      type: String,
      default: "ONU",
    },
    serialNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    macAddress: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    model: {
      type: String,
      trim: true,
      default: "",
    },
    replacedAt: {
      type: Date,
      default: Date.now,
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: "Faulty equipment replacement",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

const customerSchema = new mongoose.Schema(
  {
    // ==========================================
    // 1. Identification
    // ==========================================
    customerId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Customer / Subscriber name is required"],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    // ==========================================
    // 2. Contact Details
    // ==========================================
    phone: {
      type: String,
      required: [true, "Primary phone number is required"],
      trim: true,
      maxlength: 30,
    },

    alternatePhone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
      maxlength: 150,
    },

    // ==========================================
    // 3. Structured Location & Zone
    // ==========================================
    address: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },

    locality: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    landmark: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    state: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
      maxlength: 20,
    },

    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },

    googleMapsUrl: {
      type: String,
      trim: true,
      default: "",
    },

    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // ==========================================
    // 4. Service & Connection Details
    // ==========================================
    connectionType: {
      type: String,
      enum: ["Fiber", "Broadband", "Cable TV", "IPTV", "Other"],
      default: "Fiber",
    },

    servicePlan: {
      type: String,
      trim: true,
      default: "Standard 100 Mbps Unlimited",
    },

    installationDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "PENDING_INSTALLATION",
        "SUSPENDED",
        "DISCONNECTED",
        "Active",
        "Inactive",
      ],
      default: "ACTIVE",
    },

    // ==========================================
    // 5. Network Equipment & Replacement History
    // ==========================================
    networkEquipment: [networkEquipmentSchema],
    equipmentHistory: [equipmentHistorySchema],

    // ==========================================
    // 6. Notes & Metadata
    // ==========================================
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    referralSource: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "clients", // Map to existing collection for zero-migration compatibility
  }
);

// Pre-save hook to generate unique customerId if missing
customerSchema.pre("save", async function () {
  if (!this.customerId) {
    const count = await mongoose.model("Customer").countDocuments();
    const suffix = String(count + 1).padStart(6, "0");
    this.customerId = `SUB-${suffix}`;
  }

  // Normalize status casing
  if (this.status === "Active") this.status = "ACTIVE";
  if (this.status === "Inactive") this.status = "DISCONNECTED";
});

// Indexes
customerSchema.index({ phone: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ zone: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ connectionType: 1 });
customerSchema.index({ "networkEquipment.serialNumber": 1 });
customerSchema.index({ "networkEquipment.macAddress": 1 });

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);

module.exports = Customer;
