const router = require("express").Router();
const { getDb } = require("../database/db");
const { authRequired } = require("../middleware/auth");

router.post("/clubs/:id/join", authRequired, async (req, res) => {
  const db = await getDb();
  const clubId = Number(req.params.id);
  const userId = req.auth.sub;

  const club = await db.get("SELECT * FROM clubs WHERE id = ?", [clubId]);
  if (!club) return res.status(404).json({ message: "Club introuvable." });

  const existing = await db.get("SELECT id FROM clubMemberships WHERE clubId = ? AND userId = ?", [clubId, userId]);
  if (existing) return res.status(409).json({ message: "Vous avez déjà rejoint ce club." });

  const info = await db.run("INSERT INTO clubMemberships (clubId, userId) VALUES (?, ?)", [clubId, userId]);
  res.status(201).json({ message: `Demande envoyée au club ${club.name}.` });
});

router.post("/events/:id/register", authRequired, async (req, res) => {
  const db = await getDb();
  const eventId = Number(req.params.id);
  const userId = req.auth.sub;

  const event = await db.get("SELECT * FROM events WHERE id = ?", [eventId]);
  if (!event) return res.status(404).json({ message: "Événement introuvable." });

  const existing = await db.get("SELECT id FROM eventRegistrations WHERE eventId = ? AND userId = ?", [eventId, userId]);
  if (existing) return res.status(409).json({ message: "Déjà inscrit." });

  if (event.registered >= event.capacity) return res.status(400).json({ message: "Complet." });

  await db.run("UPDATE events SET registered = registered + 1 WHERE id = ?", [eventId]);
  await db.run("INSERT INTO eventRegistrations (eventId, userId) VALUES (?, ?)", [eventId, userId]);

  event.registered++; // Update logic for response to match old format
  event.date = event.eventDate;
  event.desc = event.description;

  res.status(201).json({ message: `Inscription confirmée pour ${event.title}.`, event });
});

router.get("/activity", authRequired, async (req, res) => {

  const db = await getDb();
  const userId = req.auth.sub;

  const clubs = await db.all("SELECT cm.status, c.id, c.name, c.category FROM clubMemberships cm JOIN clubs c ON c.id = cm.clubId WHERE cm.userId = ?", [userId]);
  const events = await db.all("SELECT e.id, e.title, e.eventDate as date, e.location FROM eventRegistrations er JOIN events e ON e.id = er.eventId WHERE er.userId = ?", [userId]);

  const formattedClubs = clubs.map(c => ({ status: c.status, club: { id: c.id, name: c.name, category: c.category } }));
  const formattedEvents = events.map(e => ({ event: e }));

  res.json({ clubs: formattedClubs, events: formattedEvents });
});

module.exports = router;
