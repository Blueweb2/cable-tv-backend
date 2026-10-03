const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Material name is required"],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    code: {
      type: String,
      required: [true, "Material SKU / Code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      default: "General",
    },
    unit: {
      type: String,
      required: [true, "Unit of measurement is required"],
      trim: true,
      default: "piece",
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    minimumStock: {
      type: Number,
      default: 10,
      min: [0, "Minimum stock cannot be negative"],
    },
    currentStock: {
      type: Number,
      default: 0,
      min: [0, "Current stock cannot be negative"],
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: [0, "Unit price cannot be negative"],
    },
    location: {
      type: String,
      trim: true,
      default: "Main Store",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

materialSchema.index({ code: 1 });
materialSchema.index({ category: 1 });
materialSchema.index({ isActive: 1 });
materialSchema.index({ currentStock: 1, minimumStock: 1 });

module.exports = mongoose.model("Material", materialSchema);
