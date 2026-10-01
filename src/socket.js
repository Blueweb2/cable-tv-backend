const { Server } = require("socket.io");

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    // Join Manager Operations Room
    socket.on("join:manager", () => {
      socket.join("manager:operations");
      console.log(`👥 Socket ${socket.id} joined manager operations room`);
      socket.emit("manager:joined", { success: true });
    });

    // Join Zone Room (for outages and zone-level broadcasts)
    socket.on("join:zone", (zoneId) => {
      if (!zoneId) return;
      const room = `zone:${zoneId}`;
      socket.join(room);
      console.log(`👥 Socket ${socket.id} joined zone room: ${room}`);
      socket.emit("zone:joined", { zoneId, room });
    });

    // Join Duty Work Order Room
    socket.on("join:duty", (dutyId) => {
      if (!dutyId) return;
      const room = `duty:${dutyId}`;
      socket.join(room);
      console.log(`👥 Socket ${socket.id} joined duty room: ${room}`);
      socket.emit("duty:joined", { dutyId, room });
    });

    // Join Technician Room
    socket.on("join:staff", (staffId) => {
      if (!staffId) return;
      const room = `staff:${staffId}`;
      socket.join(room);
      console.log(`👥 Socket ${socket.id} joined staff room: ${room}`);
      socket.emit("staff:joined", { staffId, room });
    });

    socket.on("disconnect", () => {
      console.log("🔌 Client disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = initializeSocket;