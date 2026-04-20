const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./src/database/init');

// Mount modular routers
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const publicRoutes = require('./src/routes/public');
const studentRoutes = require('./src/routes/student');

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

// ─── SECURITY MIDDLEWARES ─────────────────────────────────────
// Enable standard HTTP security headers (allows local assets to load via contentSecurityPolicy configs if needed, we'll keep it default for now but allow fonts/images)
app.use(helmet({ contentSecurityPolicy: false }));
// Enable CORS for frontend flexibility if hosted remotely
app.use(cors());

// Rate Limiting (Prevent Brute Force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs
  message: { message: "Trop de requêtes, veuillez réessayer plus tard." }
});

app.use(express.json());

// ─── STATIC ROUTES ────────────────────────────────────────────
// Secure static serving
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/photo", express.static(path.join(__dirname, "photo")));

// Automatically serve HTML files natively
app.use(express.static(__dirname, { extensions: ['html'] }));

// ─── MODULAR API ROUTES ───────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/me', studentRoutes); // Activity route -> /api/me/activity
app.use('/api', studentRoutes);    // Protected actions -> /api/clubs/:id/join, /api/events/:id/register
app.use('/api', publicRoutes);     // Public readonly data

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

// Catch-all
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack);
  res.status(500).json({ message: "Erreur interne du serveur." });
});

// Initialize database then start server
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`ISITCOM app listening on http://localhost:${port}`);
    console.log("Database: PostgreSQL (Docker)");
  });
}).catch(err => {
  console.error("Database initialization failed", err);
  process.exit(1);
});
