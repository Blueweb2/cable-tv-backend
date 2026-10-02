const authService = require("../services/auth.service");

/**
 * Register
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const {
      name,
      username,
      email,
      password,
    } = req.body;

    if (!name || !username || !email || !password) {
      const error = new Error(
        "Name, username, email and password are required"
      );
      error.statusCode = 400;
      throw error;
    }

    const trimmedName = String(name).trim();
    const trimmedUsername = String(username).trim().toLowerCase();
    const trimmedEmail = String(email).trim().toLowerCase();
    const rawPassword = String(password);

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      const error = new Error("Name must be between 2 and 50 characters");
      error.statusCode = 400;
      throw error;
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      const error = new Error("Username must be between 3 and 30 characters");
      error.statusCode = 400;
      throw error;
    }

    const usernameRegex = /^[a-z0-9._-]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      const error = new Error(
        "Username can only contain lowercase letters, numbers, dots, underscores, and hyphens"
      );
      error.statusCode = 400;
      throw error;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 150) {
      const error = new Error("Please provide a valid email address");
      error.statusCode = 400;
      throw error;
    }

    if (rawPassword.length < 6) {
      const error = new Error("Password must be at least 6 characters long");
      error.statusCode = 400;
      throw error;
    }

    // Public registration ALWAYS creates a staff role account
    const result = await authService.register({
      name: trimmedName,
      username: trimmedUsername,
      email: trimmedEmail,
      password: rawPassword,
      role: "staff",
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login
 * POST /api/auth/login
 *
 * Login using username OR email
 */
const login = async (req, res, next) => {
  try {
    const { identifier, email, username, password } = req.body;
    const loginIdentifier = identifier || email || username;

    if (!loginIdentifier || !password) {
      const error = new Error(
        "Username/email and password are required"
      );

      error.statusCode = 400;

      throw error;
    }

    const result = await authService.login({
      identifier: loginIdentifier,
      password,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(
      req.user.userId
    );

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
};