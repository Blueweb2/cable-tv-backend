const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const staffRoutes = require("./routes/staff.routes");
const zoneRoutes = require("./routes/zone.routes");
const assignmentRoutes = require("./routes/assignment.routes");
const taskRoutes = require("./routes/task.routes");
const availabilityRoutes = require("./routes/availability.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const expenseRoutes = require("./routes/expense.routes");
const reportRoutes = require("./routes/report.routes");
const departmentRoutes = require("./routes/department.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const customerRoutes = require("./routes/customer.routes");

const notFound = require("./middlewares/notFound.middleware");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type"],
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(require("path").join(__dirname, "../uploads")));

// Health check (Supports GET & HEAD on / and /api/health for platform health checks)
app.get(["/", "/api/health"], (req, res) => {
  res.status(200).json({
    success: true,
    message: "Cable Operator Staff Operations API is running",
    timestamp: new Date(),
  });
});

// Cable Operator Operations Routes
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes); // Fallback alias for requests missing /api prefix
app.use("/api/users/staff", staffRoutes);
app.use("/api/users", userRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/clients", customerRoutes); // Backward-compatible alias

// 404 handler
app.use(notFound);

// Error handler - MUST be last
app.use(errorHandler);

module.exports = app;