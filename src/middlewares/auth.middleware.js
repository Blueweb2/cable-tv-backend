const { verifyToken } = require("../utils/jwt");
const { authorize } = require("./role.middleware");
const User = require("../models/user.model");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || typeof authHeader !== "string") {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    const normalizedHeader = authHeader.trim();
    const parts = normalizedHeader.split(" ");

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== "bearer" ||
      !parts[1] ||
      parts[1].trim().length === 0
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format. Use: Bearer <token>",
      });
    }

    const token = parts[1].trim();
    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // Verify user exists and is active in database
    const user = await User.findById(decoded.userId).select("role isActive");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found or removed",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    req.user = {
      userId: user._id.toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    next(error);
  }
};

module.exports = {
  authenticate,
  protect: authenticate,
  restrictTo: authorize,
  authorize,
};