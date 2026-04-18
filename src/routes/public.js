const router = require("express").Router();
const { getDb } = require("../database/db");

router.get("/formations", async (req, res) => {
  const db = await getDb();
  const formations = await db.all("SELECT * FROM formations ORDER BY id ASC");
  res.json({ formations });
});

router.get("/clubs", async (req, res) => {
  const db = await getDb();
  const clubs = await db.all("SELECT * FROM clubs ORDER BY id ASC");
  for (let c of clubs) {
    const achs = await db.all("SELECT achievement FROM clubAchievements WHERE clubId = ?", [c.id]);
    c.achievements = achs.map(a => a.achievement);
    c.desc = c.description; // mapping for frontend format matching
  }
  res.json({ clubs });
});

router.get("/events", async (req, res) => {
  const db = await getDb();
  const events = await db.all("SELECT * FROM events ORDER BY eventDate ASC");
  for (let e of events) {
    e.date = e.eventDate;
    e.desc = e.description;
  }
  res.json({ events });
});

router.get("/courses", async (req, res) => {
  const db = await getDb();
  const courses = await db.all("SELECT * FROM courses ORDER BY id ASC");
  res.json({ courses });
});

router.get("/resources", async (req, res) => {
  const db = await getDb();
  const resources = await db.all("SELECT * FROM resources ORDER BY id ASC");
  res.json({ resources });
});

router.post("/registrations", async (req, res) => {
  const { nom, prenom, cin, classe, email, userId } = req.body;
  if (!nom || !prenom || !cin || !classe || !email) return res.status(400).json({ message: "Dossier incomplet." });

  try {
    const db = await getDb();
    const existing = await db.get("SELECT id FROM registrations WHERE cin = ?", [cin]);
    if (existing) return res.status(409).json({ message: "CIN déjà utilisé." });

    const info = await db.run("INSERT INTO registrations (userId, nom, prenom, cin, classe, email) VALUES (?, ?, ?, ?, ?, ?)",
      [userId || null, nom, prenom, cin, classe, email]);
      
    res.status(201).json({ message: "Inscription enregistrée." });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
