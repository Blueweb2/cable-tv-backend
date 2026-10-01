const Client = require("../models/client.model");
const Duty = require("../models/duty.model");

const createClient = async (clientData, userId = null) => {
  const client = await Client.create({
    ...clientData,
    createdBy: userId,
  });
  return client;
};

const getClients = async ({
  search = "",
  status = "",
  page = 1,
  limit = 20,
} = {}) => {
  const query = {};

  if (status) query.status = status;

  if (search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { alternatePhone: searchRegex },
      { city: searchRegex },
    ];
  }

  const currentPage = Math.max(Number(page) || 1, 1);
  const perPage = Math.min(Math.max(Number(limit) || 20, 1), 1000);
  const skip = (currentPage - 1) * perPage;

  const [clients, total] = await Promise.all([
    Client.find(query)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Client.countDocuments(query),
  ]);

  return {
    clients,
    pagination: {
      page: currentPage,
      limit: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};

const getClientById = async (clientId) => {
  const client = await Client.findById(clientId).populate(
    "createdBy",
    "name email role"
  );

  if (!client) {
    const error = new Error("Client not found");
    error.statusCode = 404;
    throw error;
  }

  return client;
};

const getClientDetailsWithEventsAndPayments = async (clientId) => {
  const client = await Client.findById(clientId).populate(
    "createdBy",
    "name email role"
  );

  if (!client) {
    const error = new Error("Client not found");
    error.statusCode = 404;
    throw error;
  }

  const duties = await Duty.find({
    $or: [{ "subscriber.phone": client.phone }, { "subscriber.name": client.name }],
  }).populate("staff", "name phone");

  return {
    client,
    duties,
    financialSummary: {
      totalDutiesCount: duties.length,
    },
  };
};

const updateClient = async (clientId, updateData) => {
  delete updateData.createdBy;

  const client = await Client.findByIdAndUpdate(clientId, updateData, {
    new: true,
    runValidators: true,
  }).populate("createdBy", "name email role");

  if (!client) {
    const error = new Error("Client not found");
    error.statusCode = 404;
    throw error;
  }

  return client;
};

const deactivateClient = async (clientId) => {
  const client = await Client.findByIdAndUpdate(
    clientId,
    { status: "Inactive" },
    { new: true, runValidators: true }
  ).populate("createdBy", "name email role");

  if (!client) {
    const error = new Error("Client not found");
    error.statusCode = 404;
    throw error;
  }

  return client;
};

const activateClient = async (clientId) => {
  const client = await Client.findByIdAndUpdate(
    clientId,
    { status: "Active" },
    { new: true, runValidators: true }
  ).populate("createdBy", "name email role");

  if (!client) {
    const error = new Error("Client not found");
    error.statusCode = 404;
    throw error;
  }

  return client;
};

module.exports = {
  createClient,
  getClients,
  getClientById,
  getClientDetailsWithEventsAndPayments,
  updateClient,
  deactivateClient,
  activateClient,
};