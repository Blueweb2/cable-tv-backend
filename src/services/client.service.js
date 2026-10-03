const customerService = require("./customer.service");

module.exports = {
  createClient: customerService.createCustomer,
  getClients: customerService.getCustomers,
  getClientById: customerService.getCustomerById,
  getClientDetailsWithEventsAndPayments: customerService.getCustomerDuties,
  updateClient: customerService.updateCustomer,
  deactivateClient: (id) => customerService.updateCustomerStatus(id, "DISCONNECTED"),
  activateClient: (id) => customerService.updateCustomerStatus(id, "ACTIVE"),
  ...customerService,
};