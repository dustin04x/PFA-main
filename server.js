const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./src/database/init');

// Mount modular routers
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const publicRoutes = require('./src/routes/public');
const studentRoutes = require('./src/routes/student');

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

// Secure static serving
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/photo", express.static(path.join(__dirname, "photo")));

// Modular API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/me', studentRoutes); // Activity route -> /api/me/activity
app.use('/api', studentRoutes);    // Protected actions -> /api/clubs/:id/join, /api/events/:id/register
app.use('/api', publicRoutes);     // Public readonly data

// Explicitly serve HTML files
const htmlFiles = ["index.html", "formations.html", "campus.html", "resources.html", "events.html", "portal.html"];
htmlFiles.forEach(file => {
  app.get(`/${file}`, (_req, res) => res.sendFile(path.join(__dirname, file)));
});

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

// Catch-all
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Initialize database then start server
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`ISITCOM app listening on http://localhost:${port}`);
    console.log("Database: SQLite (Loaded locally)");
  });
}).catch(err => {
  console.error("Database initialization failed", err);
  process.exit(1);
});
