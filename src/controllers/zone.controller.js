const zoneService = require("../services/zone.service");

const getAllZones = async (req, res, next) => {
  try {
    const { search, status, page, limit } = req.query;
    const result = await zoneService.getAllZones({ search, status, page, limit });
    res.json({
      success: true,
      data: result.zones,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getZoneById = async (req, res, next) => {
  try {
    const zone = await zoneService.getZoneById(req.params.id);
    res.json({
      success: true,
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

const createZone = async (req, res, next) => {
  try {
    const zone = await zoneService.createZone(req.body);
    res.status(201).json({
      success: true,
      message: "Cable zone created successfully",
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

const updateZone = async (req, res, next) => {
  try {
    const zone = await zoneService.updateZone(req.params.id, req.body);
    res.json({
      success: true,
      message: "Cable zone updated successfully",
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

const deleteZone = async (req, res, next) => {
  try {
    const result = await zoneService.deleteZone(req.params.id);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

const assignTechnicians = async (req, res, next) => {
  try {
    const zone = await zoneService.assignTechniciansToZone(req.params.id, req.body);
    res.json({
      success: true,
      message: "Technicians assigned to zone successfully",
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  assignTechnicians,
};
