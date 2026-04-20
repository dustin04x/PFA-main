const router = require("express").Router();
const { getDb } = require("../database/db");
const { authRequired, adminRequired } = require("../middleware/auth");

router.use(authRequired, adminRequired);

router.get("/overview", async (req, res) => {
  const db = await getDb();
  const [users, formations, clubs, memberships, events, eventRegs, studentRegs] = await Promise.all([
    db.get('SELECT count(id) as c FROM users'),
    db.get('SELECT count(id) as c FROM formations'),
    db.get('SELECT count(id) as c FROM clubs'),
    db.get('SELECT count(id) as c FROM clubMemberships'),
    db.get('SELECT count(id) as c FROM events'),
    db.get('SELECT count(id) as c FROM eventRegistrations'),
    db.get('SELECT count(id) as c FROM registrations')
  ]);

  res.json({
    stats: {
      users: users.c, formations: formations.c, clubs: clubs.c,
      memberships: memberships.c, events: events.c,
      eventRegistrations: eventRegs.c, studentRegistrations: studentRegs.c
    }
  });
});

router.get("/users", async (req, res) => {
  const db = await getDb();
  const users = await db.all("SELECT id, fullName, email, role, createdAt FROM users");
  res.json({ users });
});

router.post("/formations", async (req, res) => {
  const { name, level, description } = req.body;
  if (!name || !level || !description) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO formations (name, level, description) VALUES (?, ?, ?)", [name, level, description]);
  const formation = await db.get("SELECT * FROM formations WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Formation ajoutée.", formation });
});

router.delete("/formations/:id", async (req, res) => {
  const db = await getDb();
  await db.run("DELETE FROM formations WHERE id = ?", [req.params.id]);
  res.json({ message: "Formation supprimée." });
});

router.post("/clubs", async (req, res) => {
  const { name, category, desc, img } = req.body;
  if (!name || !category || !desc) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO clubs (name, category, img, description) VALUES (?, ?, ?, ?)", [name, category, img || "photo/default-club.jpg", desc]);
  const club = await db.get("SELECT * FROM clubs WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Club ajouté.", club });
});

router.delete("/clubs/:id", async (req, res) => {
  const db = await getDb();
  await db.run("DELETE FROM clubs WHERE id = ?", [req.params.id]);
  res.json({ message: "Club supprimé." });
});

router.post("/events", async (req, res) => {
  const { title, date, location, organizer, desc, capacity } = req.body;
  if (!title || !date || !location || !organizer || !desc || !capacity) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO events (title, eventDate, location, organizer, description, capacity) VALUES (?, ?, ?, ?, ?, ?)", [title, date, location, organizer, desc, capacity]);
  const event = await db.get("SELECT * FROM events WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Événement ajouté.", event });
});

router.delete("/events/:id", async (req, res) => {
  const db = await getDb();
  await db.run("DELETE FROM events WHERE id = ?", [req.params.id]);
  res.json({ message: "Événement supprimé." });
});

// ─── ADMIN: DOSSIERS (REGISTRATIONS) ─────────────────────────────────
router.get("/registrations", async (req, res) => {
  const db = await getDb();
  const registrations = await db.all("SELECT * FROM registrations ORDER BY createdAt DESC");
  res.json({ registrations });
});

router.patch("/registrations/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "Statut requis." });
  
  const db = await getDb();
  await db.run("UPDATE registrations SET status = ? WHERE id = ?", [status, req.params.id]);
  res.json({ message: "Statut mis à jour." });
});

// ─── ADMIN: COURSES ──────────────────────────────────────────────────
router.post("/courses", async (req, res) => {
  const { title, formation, teacher, description } = req.body;
  if (!title || !formation || !teacher || !description) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO courses (title, formation, teacher, description) VALUES (?, ?, ?, ?)", [title, formation, teacher, description]);
  const course = await db.get("SELECT * FROM courses WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Cours ajouté.", course });
});

router.delete("/courses/:id", async (req, res) => {
  const db = await getDb();
  await db.run("DELETE FROM courses WHERE id = ?", [req.params.id]);
  res.json({ message: "Cours supprimé." });
});

// ─── ADMIN: RESOURCES ────────────────────────────────────────────────
router.post("/resources", async (req, res) => {
  const { title, type, formation, description } = req.body;
  if (!title || !type || !formation || !description) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO resources (title, type, formation, description) VALUES (?, ?, ?, ?)", [title, type, formation, description]);
  const resource = await db.get("SELECT * FROM resources WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Ressource ajoutée.", resource });
});

router.delete("/resources/:id", async (req, res) => {
  const db = await getDb();
  await db.run("DELETE FROM resources WHERE id = ?", [req.params.id]);
  res.json({ message: "Ressource supprimée." });
});

module.exports = router;
