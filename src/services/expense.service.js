const Expense = require("../models/expense.model");

const normalize = (data) => ({
  title: String(data.title || "").trim(),
  category: data.category || "Fuel & Transit",
  amount: Number(data.amount),
  zone: data.zone || null,
  zoneName: String(data.zoneName || "").trim(),
  duty: data.duty || null,
  claimedBy: data.claimedBy || null,
  date: String(data.date || new Date().toISOString().split("T")[0]).trim(),
  paymentMethod: data.paymentMethod || "UPI",
  status: data.status || "Pending",
  description: String(data.description || "").trim(),
  billReceiptUrl: String(data.billReceiptUrl || "").trim(),
});

const validate = (data) => {
  if (!data.title || !data.date)
    throw new Error("Title and date are required");
  if (!Number.isFinite(data.amount) || data.amount <= 0)
    throw new Error("Expense amount must be greater than zero");
};

const getExpenses = async ({
  search = "",
  category = "",
  paymentMethod = "",
  status = "",
  claimedBy = "",
  zone = "",
} = {}) => {
  const query = {};
  if (category) query.category = category;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (status) query.status = status;
  if (claimedBy) query.claimedBy = claimedBy;
  if (zone) query.zone = zone;

  if (search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    query.$or = [
      { title: regex },
      { category: regex },
      { description: regex },
      { zoneName: regex },
    ];
  }

  return Expense.find(query)
    .populate("claimedBy", "name email phone department")
    .populate("zone", "name code")
    .sort({ date: -1, createdAt: -1 })
    .lean();
};

const createExpense = async (data, userId) => {
  const payload = normalize(data);
  validate(payload);
  return (
    await Expense.create({
      ...payload,
      claimedBy: payload.claimedBy || userId,
      createdBy: userId,
    })
  ).toObject();
};

const updateExpense = async (id, data) => {
  const payload = normalize(data);
  validate(payload);
  const expense = await Expense.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  })
    .populate("claimedBy", "name email phone department")
    .populate("zone", "name code")
    .lean();
  if (!expense) throw new Error("Expense not found");
  return expense;
};

const deleteExpense = async (id) => {
  const expense = await Expense.findByIdAndDelete(id);
  if (!expense) throw new Error("Expense not found");
  return { success: true, message: "Expense deleted successfully" };
};

const toggleExpenseStatus = async (id) => {
  const expense = await Expense.findById(id);
  if (!expense) throw new Error("Expense not found");
  expense.status = expense.status === "Approved" ? "Pending" : "Approved";
  await expense.save();
  return expense.toObject();
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  toggleExpenseStatus,
};