const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Duty = require("./models/duty.model");

let ioInstance = null;

/**
 * Pure authorization check helper for room joining (exported for testing)
 */
const canJoinRoom = (user, roomType, targetId, dutyDoc = null) => {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase();

  if (roomType === "manager") {
    return role === "admin" || role === "manager";
  }

  if (roomType === "staff") {
    if (role === "admin" || role === "manager") return true;
    return role === "staff" && String(user.userId) === String(targetId);
  }

  if (roomType === "duty") {
    if (role === "admin" || role === "manager") return true;
    if (role === "staff" && dutyDoc) {
      const isLead = String(dutyDoc.staff?._id || dutyDoc.staff) === String(user.userId);
      const isTeam = Array.isArray(dutyDoc.assignedStaff) &&
        dutyDoc.assignedStaff.some((s) => String(s?._id || s) === String(user.userId));
      return isLead || isTeam;
    }
    return false;
  }

  if (roomType === "zone") {
    return true; // Zone alerts are accessible to operational network personnel
  }

  return false;
};

/**
 * Socket authentication verification helper (exported for testing)
 */
const verifySocketToken = (token) => {
  if (!token) {
    throw new Error("Authentication error: Token required");
  }
  const cleanToken = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
  const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || "default_jwt_secret_dev");
  return {
    userId: decoded.userId || decoded.id || decoded._id,
    role: (decoded.role || "staff").toLowerCase(),
    email: decoded.email,
  };
};

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  ioInstance = io;

  // Authentication Handshake Middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication error: Token required"));
      }

      const user = verifySocketToken(token);
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error("Authentication error: " + err.message));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`🔌 Client connected: ${socket.id} (User: ${user?.userId}, Role: ${user?.role})`);

    // Auto-join personal staff room for authorized staff
    if (user && user.role === "staff" && user.userId) {
      socket.join(`staff:${user.userId}`);
    }

    // Auto-join manager operations room for managers & admins
    if (user && (user.role === "manager" || user.role === "admin")) {
      socket.join("manager:operations");
    }

    // Join Manager Operations Room with authorization check
    socket.on("join:manager", () => {
      if (canJoinRoom(socket.user, "manager")) {
        socket.join("manager:operations");
        socket.emit("manager:joined", { success: true });
      } else {
        socket.emit("error:unauthorized", { message: "Unauthorized room access" });
      }
    });

    // Join Zone Room (for outages and zone-level broadcasts)
    socket.on("join:zone", (zoneId) => {
      if (!zoneId) return;
      if (canJoinRoom(socket.user, "zone", zoneId)) {
        const room = `zone:${zoneId}`;
        socket.join(room);
        socket.emit("zone:joined", { zoneId, room });
      } else {
        socket.emit("error:unauthorized", { message: "Unauthorized zone room access" });
      }
    });

    // Join Duty Work Order Room with authorization check
    socket.on("join:duty", async (dutyId) => {
      if (!dutyId) return;
      try {
        let dutyDoc = null;
        if (socket.user.role === "staff") {
          dutyDoc = await Duty.findById(dutyId).select("staff assignedStaff").lean();
        }
        if (canJoinRoom(socket.user, "duty", dutyId, dutyDoc)) {
          const room = `duty:${dutyId}`;
          socket.join(room);
          socket.emit("duty:joined", { dutyId, room });
        } else {
          socket.emit("error:unauthorized", { message: "Unauthorized duty room access" });
        }
      } catch (err) {
        socket.emit("error:internal", { message: "Failed to join duty room" });
      }
    });

    // Join Technician Room with authorization check
    socket.on("join:staff", (staffId) => {
      if (!staffId) return;
      if (canJoinRoom(socket.user, "staff", staffId)) {
        const room = `staff:${staffId}`;
        socket.join(room);
        socket.emit("staff:joined", { staffId, room });
      } else {
        socket.emit("error:unauthorized", { message: "Unauthorized staff room access" });
      }
    });

    socket.on("disconnect", () => {
      console.log("🔌 Client disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => ioInstance;

const emitDutyAssigned = (duty) => {
  if (!ioInstance || !duty) return;
  const staffId = duty.staff?._id?.toString() || duty.staff?.toString();
  if (staffId) {
    ioInstance.to(`staff:${staffId}`).emit("duty:assigned", { duty });
  }
  if (Array.isArray(duty.assignedStaff)) {
    duty.assignedStaff.forEach((s) => {
      const sId = s?._id?.toString() || s?.toString();
      if (sId && sId !== staffId) {
        ioInstance.to(`staff:${sId}`).emit("duty:assigned", { duty });
      }
    });
  }
  ioInstance.to("manager:operations").emit("duty:assigned", { duty });
};

const emitDutyReassigned = (duty, oldStaffId) => {
  if (!ioInstance || !duty) return;
  if (oldStaffId) {
    ioInstance.to(`staff:${oldStaffId}`).emit("duty:reassigned", {
      dutyId: duty._id,
      message: "Your duty assignment has been reassigned to another technician",
    });
  }
  emitDutyAssigned(duty);
  ioInstance.to("manager:operations").emit("duty:reassigned", { duty, oldStaffId });
};

const emitDutyStatusChanged = (duty) => {
  if (!ioInstance || !duty) return;
  const dutyId = duty._id?.toString();
  const staffId = duty.staff?._id?.toString() || duty.staff?.toString();
  
  if (dutyId) {
    ioInstance.to(`duty:${dutyId}`).emit("duty:statusChanged", { duty });
  }
  if (staffId) {
    ioInstance.to(`staff:${staffId}`).emit("duty:statusChanged", { duty });
  }
  ioInstance.to("manager:operations").emit("duty:statusChanged", { duty });
};

const emitDutyCancelled = (duty) => {
  if (!ioInstance || !duty) return;
  const staffId = duty.staff?._id?.toString() || duty.staff?.toString();
  if (staffId) {
    ioInstance.to(`staff:${staffId}`).emit("duty:cancelled", {
      dutyId: duty._id,
      message: "This field duty has been cancelled by operations manager",
    });
  }
  ioInstance.to("manager:operations").emit("duty:cancelled", { duty });
};

module.exports = {
  initializeSocket,
  getIO,
  verifySocketToken,
  canJoinRoom,
  emitDutyAssigned,
  emitDutyReassigned,
  emitDutyStatusChanged,
  emitDutyCancelled,
};