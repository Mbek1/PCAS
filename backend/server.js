require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",").map(v => v.trim()) : false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const ROLES = ["EA_ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER", "EXECUTIVE_VIEWER"];
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: "TEAM_MEMBER" },
  department: { type: String, default: "" },
  active: { type: Boolean, default: true }
}, { timestamps: true });
const projectSchema = new mongoose.Schema({
  code: { type: String, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: "", maxlength: 3000 },
  owner: { type: String, default: "Executive Assistant" },
  priority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
  start: { type: String, default: "" },
  end: { type: String, required: true },
  status: { type: String, enum: ["Planning", "Active", "On Hold", "Completed"], default: "Planning" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: "", maxlength: 3000 },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  due: { type: String, required: true },
  priority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
  status: { type: String, enum: ["Planned", "In Progress", "Blocked", "Completed"], default: "Planned" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
const auditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, default: "" },
  summary: { type: String, required: true, maxlength: 300 }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Project = mongoose.model("Project", projectSchema);
const Task = mongoose.model("Task", taskSchema);
const AuditLog = mongoose.model("AuditLog", auditSchema);

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const audit = (user, action, entityType, entityId, summary) =>
  AuditLog.create({ actorId: user?._id, action, entityType, entityId: String(entityId || ""), summary });
const signToken = user => jwt.sign(
  { sub: String(user._id), role: user.role, name: user.name, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
);
const safeUser = user => ({
  id: String(user._id), name: user.name, email: user.email,
  role: user.role, department: user.department, active: user.active
});
const authenticate = asyncRoute(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || !user.active) return res.status(401).json({ message: "Account unavailable." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session. Please sign in again." });
  }
});
const allow = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "You do not have permission to perform this action." });
  next();
};
const canManageWork = allow("EA_ADMIN", "PROJECT_MANAGER");
const canManageUsers = allow("EA_ADMIN");

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "PCAS API" }));

app.post("/api/auth/setup", asyncRoute(async (req, res) => {
  if (!process.env.SETUP_SECRET || req.body.setupSecret !== process.env.SETUP_SECRET)
    return res.status(403).json({ message: "Invalid setup credentials." });
  if (await User.countDocuments()) return res.status(409).json({ message: "Initial administrator has already been created." });
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 12)
    return res.status(400).json({ message: "Provide name, email and a password of at least 12 characters." });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: "EA_ADMIN" });
  await audit(user, "USER_SETUP", "User", user._id, "Initial EA administrator account created");
  res.status(201).json({ user: safeUser(user), token: signToken(user) });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !user.active || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash)))
    return res.status(401).json({ message: "Email or password is incorrect." });
  res.json({ user: safeUser(user), token: signToken(user) });
}));
app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: safeUser(req.user) }));

app.get("/api/users", authenticate, asyncRoute(async (req, res) => {
  const users = await User.find({ active: true }).sort({ name: 1 });
  res.json({ users: users.map(safeUser) });
}));
app.post("/api/users", authenticate, canManageUsers, asyncRoute(async (req, res) => {
  const { name, email, password, role, department } = req.body;
  if (!name || !email || !password || password.length < 12 || !ROLES.includes(role))
    return res.status(400).json({ message: "Name, email, a password of at least 12 characters and a valid role are required." });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role, department: department || "" });
  await audit(req.user, "USER_CREATE", "User", user._id, "Created user " + user.email);
  res.status(201).json({ user: safeUser(user) });
}));
app.patch("/api/users/:id", authenticate, canManageUsers, asyncRoute(async (req, res) => {
  const updates = {};
  for (const key of ["name", "role", "department", "active"]) if (req.body[key] !== undefined) updates[key] = req.body[key];
  if (updates.role && !ROLES.includes(updates.role)) return res.status(400).json({ message: "Invalid role." });
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ message: "User not found." });
  await audit(req.user, "USER_UPDATE", "User", user._id, "Updated user " + user.email);
  res.json({ user: safeUser(user) });
}));

app.get("/api/projects", authenticate, asyncRoute(async (req, res) => {
  const projects = await Project.find().sort({ updatedAt: -1 });
  res.json({ projects });
}));
app.post("/api/projects", authenticate, canManageWork, asyncRoute(async (req, res) => {
  const { name, end } = req.body;
  if (!name || !end) return res.status(400).json({ message: "Project name and target date are required." });
  const project = await Project.create({ ...req.body, createdBy: req.user._id });
  await audit(req.user, "PROJECT_CREATE", "Project", project._id, "Created project " + project.name);
  res.status(201).json({ project });
}));
app.put("/api/projects/:id", authenticate, canManageWork, asyncRoute(async (req, res) => {
  const allowed = ["code", "name", "description", "owner", "priority", "start", "end", "status"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const project = await Project.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!project) return res.status(404).json({ message: "Project not found." });
  await audit(req.user, "PROJECT_UPDATE", "Project", project._id, "Updated project " + project.name);
  res.json({ project });
}));

app.get("/api/tasks", authenticate, asyncRoute(async (req, res) => {
  const filter = req.user.role === "TEAM_MEMBER" ? { assigneeId: req.user._id } : {};
  const tasks = await Task.find(filter).populate("assigneeId", "name email role").populate("projectId", "name code").sort({ due: 1 });
  res.json({ tasks });
}));
app.post("/api/tasks", authenticate, canManageWork, asyncRoute(async (req, res) => {
  const { title, projectId, due } = req.body;
  if (!title || !projectId || !due) return res.status(400).json({ message: "Task title, project and due date are required." });
  const task = await Task.create({ ...req.body, createdBy: req.user._id });
  await audit(req.user, "TASK_CREATE", "Task", task._id, "Created task " + task.title);
  res.status(201).json({ task });
}));
app.put("/api/tasks/:id", authenticate, asyncRoute(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found." });
  const isManager = ["EA_ADMIN", "PROJECT_MANAGER"].includes(req.user.role);
  if (!isManager && (req.user.role !== "TEAM_MEMBER" || String(task.assigneeId) !== String(req.user._id)))
    return res.status(403).json({ message: "You cannot update this task." });
  const allowed = isManager ? ["title", "description", "projectId", "assigneeId", "due", "priority", "status"] : ["status"];
  for (const key of allowed) if (req.body[key] !== undefined) task[key] = req.body[key];
  await task.save();
  await audit(req.user, "TASK_UPDATE", "Task", task._id, "Updated task " + task.title);
  res.json({ task });
}));

app.get("/api/audit", authenticate, allow("EA_ADMIN", "EXECUTIVE_VIEWER"), asyncRoute(async (req, res) => {
  const logs = await AuditLog.find().populate("actorId", "name email").sort({ createdAt: -1 }).limit(200);
  res.json({ logs });
}));

app.use((req, res) => res.status(404).json({ message: "API route not found." }));
app.use((err, req, res, next) => {
  if (err && err.code === 11000) return res.status(409).json({ message: "That email address is already registered." });
  if (err && err.name === "ValidationError") return res.status(400).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

const port = Number(process.env.PORT || 10000);
async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || !process.env.SETUP_SECRET) {
    console.error("Missing required environment variables: MONGODB_URI, JWT_SECRET and SETUP_SECRET.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  app.listen(port, () => console.log("PCAS API listening on port " + port));
}
start().catch(err => { console.error("Database connection failed:", err.message); process.exit(1); });
