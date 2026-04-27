const router = require("express").Router();
const { getDb } = require("../database/db");
const { authRequired } = require("../middleware/auth");

async function getCurrentUser(db, userId) {
  return db.get("SELECT id, fullName, role, ownedClubId FROM users WHERE id = ?", [userId]);
}

router.post("/clubs/:id/join", authRequired, async (req, res) => {
  const db = await getDb();
  const clubId = Number(req.params.id);
  const userId = req.auth.sub;

  const club = await db.get("SELECT * FROM clubs WHERE id = ?", [clubId]);
  if (!club) return res.status(404).json({ message: "Club introuvable." });

  const existing = await db.get("SELECT id, status FROM clubMemberships WHERE clubId = ? AND userId = ?", [clubId, userId]);
  if (existing) {
    if (existing.status === "rejected") {
      await db.run("UPDATE clubMemberships SET status = 'pending' WHERE id = ?", [existing.id]);
      return res.status(200).json({ message: `Votre demande pour ${club.name} a ete renvoyee.` });
    }
    return res.status(409).json({ message: "Vous avez deja envoye une demande pour ce club." });
  }

  await db.run("INSERT INTO clubMemberships (clubId, userId, status) VALUES (?, ?, 'pending')", [clubId, userId]);
  res.status(201).json({ message: `Demande envoyee au club ${club.name}.` });
});

router.post("/events/:id/register", authRequired, async (req, res) => {
  const db = await getDb();
  const eventId = Number(req.params.id);
  const userId = req.auth.sub;

  const existing = await db.get("SELECT id FROM eventRegistrations WHERE eventId = ? AND userId = ?", [eventId, userId]);
  if (existing) return res.status(409).json({ message: "Deja inscrit." });

  try {
    const updateInfo = await db.run("UPDATE events SET registered = registered + 1 WHERE id = ? AND registered < capacity", [eventId]);

    if (updateInfo.changes === 0) {
      const event = await db.get("SELECT capacity, registered FROM events WHERE id = ?", [eventId]);
      if (!event) return res.status(404).json({ message: "Evenement introuvable." });
      return res.status(400).json({ message: "Complet." });
    }

    await db.run("INSERT INTO eventRegistrations (eventId, userId) VALUES (?, ?)", [eventId, userId]);

    const event = await db.get("SELECT * FROM events WHERE id = ?", [eventId]);
    event.date = event.eventDate;
    event.desc = event.description;

    res.status(201).json({ message: `Inscription confirmee pour ${event.title}.`, event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de l'inscription." });
  }
});

router.get("/activity", authRequired, async (req, res) => {
  const db = await getDb();
  const userId = req.auth.sub;

  const clubs = await db.all(
    "SELECT cm.id AS membershipId, cm.status, c.id AS clubId, c.name, c.category FROM clubMemberships cm JOIN clubs c ON c.id = cm.clubId WHERE cm.userId = ?",
    [userId]
  );
  const events = await db.all(
    "SELECT e.id, e.title, e.eventDate as date, e.location FROM eventRegistrations er JOIN events e ON e.id = er.eventId WHERE er.userId = ?",
    [userId]
  );
  const registrationInfo = await db.get("SELECT nom, prenom, classe, status FROM registrations WHERE userId = ?", [userId]);

  const formattedClubs = clubs.map(c => ({
    id: c.membershipId,
    status: c.status,
    club: { id: c.clubId, name: c.name, category: c.category }
  }));
  const formattedEvents = events.map(e => ({ event: e }));

  res.json({ clubs: formattedClubs, events: formattedEvents, registrationInfo });
});

router.get("/club-owner/requests", authRequired, async (req, res) => {
  const db = await getDb();
  const user = await getCurrentUser(db, req.auth.sub);

  if (!user || !["club_owner", "admin"].includes(user.role)) {
    return res.status(403).json({ message: "Acces reserve au responsable du club." });
  }

  if (!user.ownedClubId) {
    return res.status(400).json({ message: "Aucun club rattache a ce compte." });
  }

  const requests = await db.all(`
    SELECT
      cm.id,
      cm.status,
      cm.createdAt,
      u.id AS userId,
      u.fullName,
      u.email,
      c.id AS clubId,
      c.name AS clubName,
      c.category AS clubCategory
    FROM clubMemberships cm
    JOIN users u ON u.id = cm.userId
    JOIN clubs c ON c.id = cm.clubId
    WHERE cm.clubId = ?
    ORDER BY cm.createdAt DESC, cm.id DESC
  `, [user.ownedClubId]);

  res.json({
    club: {
      id: user.ownedClubId
    },
    requests
  });
});

router.patch("/club-owner/requests/:id", authRequired, async (req, res) => {
  const status = String(req.body.status || "").toLowerCase();
  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Statut invalide." });
  }

  const db = await getDb();
  const user = await getCurrentUser(db, req.auth.sub);
  if (!user || !["club_owner", "admin"].includes(user.role)) {
    return res.status(403).json({ message: "Acces reserve au responsable du club." });
  }

  if (!user.ownedClubId) {
    return res.status(400).json({ message: "Aucun club rattache a ce compte." });
  }

  const membership = await db.get(
    "SELECT id, clubId, status FROM clubMemberships WHERE id = ? AND clubId = ?",
    [req.params.id, user.ownedClubId]
  );
  if (!membership) {
    return res.status(404).json({ message: "Demande introuvable." });
  }
  if (membership.status !== "pending") {
    return res.status(409).json({ message: "Cette demande a deja ete traitee." });
  }

  await db.run("UPDATE clubMemberships SET status = ? WHERE id = ? AND clubId = ? AND status = 'pending'", [status, req.params.id, user.ownedClubId]);
  if (status === "accepted") {
    await db.run("UPDATE clubs SET members = members + 1 WHERE id = ?", [user.ownedClubId]);
  }

  res.json({ message: status === "accepted" ? "Demande acceptee." : "Demande rejetee." });
});

module.exports = router;
