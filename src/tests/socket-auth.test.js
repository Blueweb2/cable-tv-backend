const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");

const {
  verifySocketToken,
  canJoinRoom,
} = require("../socket");

const TEST_SECRET = process.env.JWT_SECRET || "default_jwt_secret_dev";

test("Socket Authentication: Valid JWT token is verified and extracts user claims", () => {
  const token = jwt.sign(
    { userId: "staff-100", role: "staff", email: "tech@cableops.com" },
    TEST_SECRET,
    { expiresIn: "1h" }
  );

  const user = verifySocketToken(token);
  assert.strictEqual(user.userId, "staff-100");
  assert.strictEqual(user.role, "staff");
  assert.strictEqual(user.email, "tech@cableops.com");
});

test("Socket Authentication: Missing or invalid token throws authentication error", () => {
  assert.throws(() => verifySocketToken(""), /Token required/);
  assert.throws(() => verifySocketToken("invalid.token.structure"), /jwt malformed|invalid token/i);
});

test("Socket Room Authorization: Staff can only join own staff room and cannot join another technician's room", () => {
  const staffUser = { userId: "staff-100", role: "staff" };

  assert.strictEqual(canJoinRoom(staffUser, "staff", "staff-100"), true, "Staff can join own room");
  assert.strictEqual(canJoinRoom(staffUser, "staff", "staff-999"), false, "Staff CANNOT join another staff room");
});

test("Socket Room Authorization: Staff cannot join manager operations room; Manager can", () => {
  const staffUser = { userId: "staff-100", role: "staff" };
  const managerUser = { userId: "mgr-001", role: "manager" };
  const adminUser = { userId: "admin-001", role: "admin" };

  assert.strictEqual(canJoinRoom(staffUser, "manager"), false, "Staff cannot join manager room");
  assert.strictEqual(canJoinRoom(managerUser, "manager"), true, "Manager can join manager room");
  assert.strictEqual(canJoinRoom(adminUser, "manager"), true, "Admin can join manager room");
});

test("Socket Room Authorization: Duty work order room access requires assignment membership for staff", () => {
  const staffA = { userId: "staff-A", role: "staff" };
  const staffB = { userId: "staff-B", role: "staff" };
  const staffC = { userId: "staff-C", role: "staff" };
  const manager = { userId: "mgr-001", role: "manager" };

  const dutyDoc = {
    _id: "duty-555",
    staff: "staff-A",
    assignedStaff: ["staff-A", "staff-B"],
  };

  assert.strictEqual(canJoinRoom(staffA, "duty", "duty-555", dutyDoc), true, "Lead tech can join duty room");
  assert.strictEqual(canJoinRoom(staffB, "duty", "duty-555", dutyDoc), true, "Team member can join duty room");
  assert.strictEqual(canJoinRoom(staffC, "duty", "duty-555", dutyDoc), false, "Unassigned tech cannot join duty room");
  assert.strictEqual(canJoinRoom(manager, "duty", "duty-555", dutyDoc), true, "Manager can join any duty room");
});

test("8. Manager can receive manager operational events", () => {
  const manager = { userId: "mgr-001", role: "manager" };
  const admin = { userId: "adm-001", role: "admin" };
  const staff = { userId: "staff-100", role: "staff" };

  assert.strictEqual(canJoinRoom(manager, "manager"), true, "Manager receives manager ops room events");
  assert.strictEqual(canJoinRoom(admin, "manager"), true, "Admin receives manager ops room events");
  assert.strictEqual(canJoinRoom(staff, "manager"), false, "Staff cannot receive manager ops room events");
});
