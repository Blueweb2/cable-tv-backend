require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectDB = require("../config/db");
const User = require("../models/user.model");
const Zone = require("../models/zone.model");
const Duty = require("../models/duty.model");
const Attendance = require("../models/attendance.model");
const Material = require("../models/material.model");

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();

    console.log("Checking seed users...");

    // 1. Seed Manager/Admin
    let admin = await User.findOne({
      $or: [{ email: "manager@cableops.com" }, { email: "admin@cableops.com" }, { email: "admin@eventmanagement.com" }],
    });

    if (!admin) {
      const hashedAdminPassword = await bcrypt.hash("Password123!", 12);
      admin = await User.create({
        name: "Admin Manager",
        username: "admin_manager",
        email: "manager@cableops.com",
        password: hashedAdminPassword,
        role: "admin",
        phone: "+91 98765 43210",
        location: "Central NOC Station",
        department: "Network Operations (NOC)",
        employmentType: "full-time",
        isActive: true,
      });
      console.log("Created default manager: manager@cableops.com / Password123!");
    } else {
      console.log("Manager already exists:", admin.email);
    }

    // 2. Seed Technicians & Field Staff
    const techniciansData = [
      {
        name: "Rahul Sharma",
        username: "rahul_sharma",
        email: "rahul@cableops.com",
        phone: "+91 98111 22334",
        location: "North Sector Hub",
        department: "Fiber Optics & Splicing",
        specialization: "Fiber Technician",
        role: "staff",
      },
      {
        name: "Vikram Singh",
        username: "vikram_linesman",
        email: "vikram@cableops.com",
        phone: "+91 98222 33445",
        location: "East Distribution Area",
        department: "Field Linesmen & Wiring",
        specialization: "Linesman",
        role: "staff",
      },
      {
        name: "Amit Verma",
        username: "amit_install",
        email: "amit@cableops.com",
        phone: "+91 98333 44556",
        location: "Central Grid Station",
        department: "New Installations & STB Setup",
        specialization: "Installation Technician",
        role: "staff",
      },
      {
        name: "Arun Kumar",
        username: "arun_staff",
        email: "arun@cableops.com",
        phone: "+91 98444 55667",
        location: "West Residential Zone",
        department: "Field Linesmen & Wiring",
        specialization: "Linesman",
        role: "staff",
      },
    ];

    const seededTechs = [];
    for (const techData of techniciansData) {
      let tech = await User.findOne({ email: techData.email });
      if (!tech) {
        const hashedPassword = await bcrypt.hash("staff123", 12);
        tech = await User.create({
          ...techData,
          password: hashedPassword,
          employmentType: "full-time",
          isActive: true,
          createdBy: admin._id,
        });
        console.log(`Created technician: ${tech.name} (${tech.email}) / staff123`);
      }
      seededTechs.push(tech);
    }

    // 3. Seed Cable Network Zones & Nodes
    const zoneCount = await Zone.countDocuments();
    let zones = [];
    if (zoneCount === 0) {
      zones = await Zone.create([
        {
          name: "North Sector Fiber Ring A",
          code: "Z-NORTH-01",
          zoneType: "FIBER_FTTH",
          coverageArea: "Sectors 1 to 8, Green Park & Metro Corridor",
          totalSubscribers: 1420,
          assignedLead: seededTechs[0]._id,
          assignedStaff: [seededTechs[0]._id, seededTechs[1]._id],
          status: "OPERATIONAL",
          nodes: [
            { nodeNumber: "NODE-N1", location: "Pillar 14 Junction", opticalPowerDbm: "-17.5 dBm", status: "HEALTHY", amplifierCount: 3 },
            { nodeNumber: "NODE-N2", location: "Sector 4 Main Cross", opticalPowerDbm: "-21.2 dBm", status: "WARNING", amplifierCount: 2 },
            { nodeNumber: "NODE-N3", location: "Metro Gate 2 Splitter", opticalPowerDbm: "-16.8 dBm", status: "HEALTHY", amplifierCount: 4 },
          ],
        },
        {
          name: "Central Commercial Grid",
          code: "Z-CENTRAL-02",
          zoneType: "HYBRID_HFC",
          coverageArea: "Main Market, Financial Plaza & Mall Road",
          totalSubscribers: 2150,
          assignedLead: seededTechs[1]._id,
          assignedStaff: [seededTechs[1]._id, seededTechs[2]._id],
          status: "OPERATIONAL",
          nodes: [
            { nodeNumber: "NODE-C1", location: "Market Tower 1", opticalPowerDbm: "-15.0 dBm", status: "HEALTHY", amplifierCount: 5 },
            { nodeNumber: "NODE-C2", location: "Plaza Substation", opticalPowerDbm: "-18.4 dBm", status: "HEALTHY", amplifierCount: 3 },
          ],
        },
        {
          name: "East Residential Zone",
          code: "Z-EAST-03",
          zoneType: "RESIDENTIAL_SECTOR",
          coverageArea: "Sunrise Enclave, Block A-D, Riverview Apts",
          totalSubscribers: 890,
          assignedLead: seededTechs[2]._id,
          assignedStaff: [seededTechs[2]._id, seededTechs[3]._id],
          status: "MAINTENANCE",
          nodes: [
            { nodeNumber: "NODE-E1", location: "Block B Transformer Post", opticalPowerDbm: "-24.0 dBm", status: "CRITICAL", amplifierCount: 2 },
          ],
        },
      ]);
      console.log("Created 3 Cable Network Zones.");
    } else {
      zones = await Zone.find();
    }

    // 4. Seed Field Duties / Work Orders
    const dutyCount = await Duty.countDocuments();
    if (dutyCount === 0 && zones.length > 0) {
      const today = new Date();
      await Duty.create([
        {
          zone: zones[0]._id,
          zoneName: zones[0].name,
          nodeNumber: "NODE-N2",
          staff: seededTechs[0]._id,
          dutyTitle: "Fiber Core Splicing & Optical Power Calibration",
          jobType: "FIBER_SPLICING",
          priority: "HIGH",
          role: "Fiber Specialist",
          department: "Fiber Optics & Splicing",
          serviceName: "FTTH Network Repair",
          description: "High attenuation detected on Core #6 at Sector 4 Main Cross. Splice replacement and OTDR test required.",
          location: "Sector 4 Main Cross, Node-N2",
          subscriber: { name: "Sector 4 Cluster Substation", phone: "+91 98100 00001", accountNo: "NODE-N2" },
          dutyDate: today,
          startTime: "09:00",
          endTime: "13:00",
          hourlyRate: 150,
          totalHours: 4,
          totalAmount: 600,
          status: "IN_PROGRESS",
          checklist: [
            { text: "Safety gear & cone placement on road cross", completed: true },
            { text: "OTDR distance fault identification", completed: true },
            { text: "Fusion splicing of Core #4 & #6", completed: false },
            { text: "Optical power level verification below -18 dBm", completed: false },
          ],
          assignedBy: admin._id,
        },
        {
          zone: zones[2]._id,
          zoneName: zones[2].name,
          nodeNumber: "NODE-E1",
          staff: seededTechs[1]._id,
          dutyTitle: "Node Amplifier Power Supply Replacement",
          jobType: "NODE_MAINTENANCE",
          priority: "CRITICAL_OUTAGE",
          role: "Linesman Lead",
          department: "Field Linesmen & Wiring",
          serviceName: "Amplifier Station Repair",
          description: "Low RF signal output reported across Sunrise Enclave Block B. Check 60V AC power supply and replace faulty amplifier unit.",
          location: "Block B Transformer Post, Node-E1",
          subscriber: { name: "Sunrise Enclave Resident Association", phone: "+91 98200 00002", accountNo: "NODE-E1" },
          dutyDate: today,
          startTime: "10:30",
          endTime: "14:30",
          hourlyRate: 140,
          totalHours: 4,
          totalAmount: 560,
          status: "ASSIGNED",
          checklist: [
            { text: "Inspect input RF signal at Node-E1 tap", completed: false },
            { text: "Replace 60V power inserter unit", completed: false },
            { text: "Measure forward & reverse signal levels", completed: false },
          ],
          assignedBy: admin._id,
        },
        {
          zone: zones[1]._id,
          zoneName: zones[1].name,
          nodeNumber: "NODE-C1",
          staff: seededTechs[2]._id,
          dutyTitle: "New FTTH High-Speed Fiber Connection Installation",
          jobType: "NEW_INSTALLATION",
          priority: "MEDIUM",
          role: "Installation Technician",
          department: "New Installations & STB Setup",
          serviceName: "Dual Band Wi-Fi & HD STB Setup",
          description: "Install drop fiber cable from Tap 4, configure ONT router and activate 300 Mbps broadband + HD STB package.",
          location: "Flat 402, Financial Heights, Mall Road",
          subscriber: { name: "Rajesh Malhotra", phone: "+91 98300 00003", accountNo: "SUB-88219", address: "Flat 402, Financial Heights" },
          dutyDate: today,
          startTime: "14:00",
          endTime: "16:30",
          hourlyRate: 120,
          totalHours: 2.5,
          totalAmount: 300,
          status: "ASSIGNED",
          checklist: [
            { text: "Drop fiber routing from pole to customer premises", completed: false },
            { text: "Fiber patch cord splicing & testing", completed: false },
            { text: "Wi-Fi Router & STB activation with subscriber app", completed: false },
            { text: "Collect installation acknowledgement signature", completed: false },
          ],
          assignedBy: admin._id,
        },
      ]);
      console.log("Created 3 Cable Operator Field Duties.");
    }

    // 5. Seed Material Catalog
    const materialCount = await Material.countDocuments();
    if (materialCount === 0) {
      await Material.insertMany([
        {
          name: "6-Core Armored Single-Mode Fiber Cable",
          code: "FIB-6C-ARM",
          category: "Fiber Cable",
          unit: "meter",
          description: "Heavy-duty outdoor armored optical fiber cable for trunk line distribution.",
          minimumStock: 200,
          currentStock: 1500,
          unitPrice: 25,
          location: "Main Store",
        },
        {
          name: "2-Core FTTH Drop Cable with FRP",
          code: "DRP-2C-FRP",
          category: "Drop Cable",
          unit: "meter",
          description: "G.657A1 bend-insensitive fiber drop cable for subscriber premises connection.",
          minimumStock: 300,
          currentStock: 2200,
          unitPrice: 12,
          location: "Main Store",
        },
        {
          name: "RG-6 Coaxial Cable with 60% Braid",
          code: "COAX-RG6-60",
          category: "Installation Accessories",
          unit: "meter",
          description: "75 Ohm RG6 coaxial cable for CATV and RF distribution.",
          minimumStock: 150,
          currentStock: 800,
          unitPrice: 15,
          location: "Main Store",
        },
        {
          name: "SC/APC Fast Assembly Optical Connector",
          code: "CONN-SC-APC",
          category: "Connector",
          unit: "piece",
          description: "Field-assembly SC/APC green optical fast connector for drop cable termination.",
          minimumStock: 50,
          currentStock: 350,
          unitPrice: 45,
          location: "Main Store",
        },
        {
          name: "Heat Shrinkable Fusion Splice Sleeve 60mm",
          code: "SLV-60MM-SS",
          category: "Splice Sleeve",
          unit: "piece",
          description: "Stainless steel rod reinforced transparent heat shrink splice protection sleeves.",
          minimumStock: 100,
          currentStock: 600,
          unitPrice: 5,
          location: "Main Store",
        },
        {
          name: "GPON Gigabit ONU 1GE + 1FE + Wi-Fi",
          code: "ONU-GPON-WIFI",
          category: "ONU",
          unit: "piece",
          description: "High-performance FTTH Optical Network Unit for residential broadband.",
          minimumStock: 15,
          currentStock: 45,
          unitPrice: 1250,
          location: "Main Store",
        },
        {
          name: "Dual Band Gigabit AC1200 Wi-Fi Router",
          code: "RTR-AC1200-DB",
          category: "Router",
          unit: "piece",
          description: "802.11ac 1200Mbps dual-band Wi-Fi router with 4 high-gain antennas.",
          minimumStock: 10,
          currentStock: 30,
          unitPrice: 1800,
          location: "Main Store",
        },
        {
          name: "HD Digital Cable Set-Top Box (DVB-C)",
          code: "STB-DVBC-HD",
          category: "STB",
          unit: "piece",
          description: "Standard DVB-C MPEG-4 HD Set-top Box with CAS smartcard support.",
          minimumStock: 20,
          currentStock: 60,
          unitPrice: 950,
          location: "Main Store",
        },
        {
          name: "12V 1.5A DC Power Adapter for ONT/Router",
          code: "PWR-12V-15A",
          category: "Power Adapter",
          unit: "piece",
          description: "Universal switching power supply adapter with surge protection.",
          minimumStock: 25,
          currentStock: 75,
          unitPrice: 180,
          location: "Main Store",
        },
        {
          name: "4-Way Outdoor CATV Splitter 5-1000MHz",
          code: "SPL-4WAY-1G",
          category: "Installation Accessories",
          unit: "piece",
          description: "Zinc diecast housing 4-way RF splitter for multi-TV installations.",
          minimumStock: 20,
          currentStock: 80,
          unitPrice: 85,
          location: "Main Store",
        },
      ]);
      console.log("Seeded 10 default CableOps Material Catalog items.");
    }

    console.log("Seeding complete successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seed();
