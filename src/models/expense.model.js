const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    category: {
      type: String,
      enum: [
        "Fuel & Transit",
        "Fiber & Cable Material",
        "Connectors & Hardware",
        "Node & Amplifier Spares",
        "Tools & Safety Gear",
        "Staff Allowance",
        "Emergency Outage Food",
        "Other",
      ],
      default: "Fuel & Transit",
    },
    amount: { type: Number, required: true, min: 0 },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", default: null },
    zoneName: { type: String, trim: true, default: "" },
    duty: { type: mongoose.Schema.Types.ObjectId, ref: "Duty", default: null },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    date: { type: String, required: true, trim: true },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "UPI", "Card", "Petty Cash", "Other"],
      default: "UPI",
    },
    status: { type: String, enum: ["Approved", "Pending", "Rejected"], default: "Pending" },
    description: { type: String, trim: true, default: "", maxlength: 1000 },
    billReceiptUrl: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, status: 1 });
expenseSchema.index({ claimedBy: 1 });

module.exports = mongoose.model("Expense", expenseSchema);