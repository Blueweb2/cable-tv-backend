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

app.use("/api", apiLimiter);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(require("path").join(__dirname, "../uploads")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Cable Operator Staff Operations API is running",
    timestamp: new Date(),
  });
});

// Cable Operator Operations Routes
app.use("/api/auth", authRoutes);
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

// 404 handler
app.use(notFound);

// Error handler - MUST be last
app.use(errorHandler);

module.exports = app;