const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: [true, "Material reference is required"],
    },
    location: {
      type: String,
      trim: true,
      default: "Main Store",
    },
    transactionType: {
      type: String,
      enum: [
        "STOCK_IN",
        "STOCK_OUT",
        "ADJUSTMENT",
        "RETURN",
        "DAMAGE",
        "TRANSFER",
      ],
      required: [true, "Transaction type is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.001, "Quantity must be greater than zero"],
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    duty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Duty",
      default: null,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    materialRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialRequest",
      default: null,
    },
    reference: {
      type: String,
      trim: true,
      default: "",
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User performing transaction is required"],
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

stockTransactionSchema.index({ material: 1, createdAt: -1 });
stockTransactionSchema.index({ transactionType: 1 });
stockTransactionSchema.index({ duty: 1 });
stockTransactionSchema.index({ technician: 1 });

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
