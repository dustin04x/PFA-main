const router = require("express").Router();
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getDb } = require("../database/db");
const { authRequired } = require("../middleware/auth");

// Configure multer for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "photo/profiles";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Seules les images (jpeg, jpg, png, webp) sont autorisees."));
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

router.use(authRequired);

function requireAdmin(req, res) {
  if (req.auth?.role !== "admin") {
    res.status(403).json({ message: "Acces reserve aux administrateurs." });
    return false;
  }
  return true;
}

function canManageContent(req) {
  return req.auth?.role === "admin" || req.auth?.role === "teacher";
}

async function getClubById(db, clubId) {
  if (!clubId) return null;
  return db.get("SELECT id, name FROM clubs WHERE id = ?", [clubId]);
}

async function getUserRecord(db, id) {
  return db.get(`
    SELECT u.id, u.fullName, u.email, u.role, u.ownedClubId, u.profilePicture, u.createdAt, c.name AS clubName
    FROM users u
    LEFT JOIN clubs c ON c.id = u.ownedClubId
    WHERE u.id = ?
  `, [id]);
}

function normalizeRole(role) {
  const allowed = new Set(["student", "club_owner", "teacher", "admin"]);
  return allowed.has(role) ? role : null;
}

router.get("/overview", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  const [users, formations, clubs, memberships, events, eventRegs, studentRegs] = await Promise.all([
    db.get("SELECT count(id) as c FROM users"),
    db.get("SELECT count(id) as c FROM formations"),
    db.get("SELECT count(id) as c FROM clubs"),
    db.get("SELECT count(id) as c FROM clubMemberships"),
    db.get("SELECT count(id) as c FROM events"),
    db.get("SELECT count(id) as c FROM eventRegistrations"),
    db.get("SELECT count(id) as c FROM registrations")
  ]);

  res.json({
    stats: {
      users: users.c,
      formations: formations.c,
      clubs: clubs.c,
      memberships: memberships.c,
      events: events.c,
      eventRegistrations: eventRegs.c,
      studentRegistrations: studentRegs.c
    }
  });
});

router.get("/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  const search = String(req.query.search || "").trim().toLowerCase();
  const users = await db.all(`
    SELECT u.id, u.fullName, u.email, u.role, u.ownedClubId, u.profilePicture, u.createdAt, c.name AS clubName
    FROM users u
    LEFT JOIN clubs c ON c.id = u.ownedClubId
    ORDER BY u.createdAt DESC, u.id DESC
  `);

  const filtered = search
    ? users.filter(user => {
        const haystack = [
          user.fullName,
          user.email,
          user.role,
          user.clubName || ""
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
    : users;

  res.json({ users: filtered });
});

router.post("/users", upload.single("profilePicture"), async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { fullName, email, password, role, clubId } = req.body;
  const normalizedRole = normalizeRole(role);
  if (!fullName || !email || !password || !normalizedRole) {
    return res.status(400).json({ message: "Champs requis." });
  }

  const db = await getDb();
  const exists = await db.get("SELECT id FROM users WHERE email = ?", [email]);
  if (exists) {
    return res.status(409).json({ message: "Un compte existe deja avec cet email." });
  }

  let assignedClubId = null;
  if (normalizedRole === "club_owner") {
    assignedClubId = clubId ? Number(clubId) : null;
    if (!assignedClubId) {
      return res.status(400).json({ message: "Le club du responsable est obligatoire." });
    }
    const club = await getClubById(db, assignedClubId);
    if (!club) {
      return res.status(404).json({ message: "Club introuvable." });
    }
    const owner = await db.get("SELECT id FROM users WHERE ownedClubId = ?", [assignedClubId]);
    if (owner) {
      return res.status(409).json({ message: "Ce club a deja un responsable." });
    }
  }

  const profilePicture = req.file ? req.file.path.replace(/\\/g, "/") : null;
  const hash = await bcrypt.hash(password, 10);
  const info = await db.run(
    "INSERT INTO users (fullName, email, passwordHash, role, ownedClubId, profilePicture) VALUES (?, ?, ?, ?, ?, ?)",
    [fullName, email, hash, normalizedRole, assignedClubId, profilePicture]
  );

  const user = await getUserRecord(db, info.lastID);
  res.status(201).json({ message: "Compte cree.", user });
});

router.patch("/users/:id", upload.single("profilePicture"), async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  const user = await getUserRecord(db, req.params.id);
  if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });

  const fullName = req.body.fullName || user.fullName;
  const email = req.body.email || user.email;
  const normalizedRole = normalizeRole(req.body.role || user.role);
  const password = req.body.password || "";
  const clubIdValue = req.body.clubId === "" || req.body.clubId == null ? null : Number(req.body.clubId);
  const profilePicture = req.file ? req.file.path.replace(/\\/g, "/") : user.profilePicture;

  if (!fullName || !email || !normalizedRole) {
    return res.status(400).json({ message: "Champs requis." });
  }

  const emailOwner = await db.get("SELECT id FROM users WHERE email = ? AND id <> ?", [email, user.id]);
  if (emailOwner) {
    return res.status(409).json({ message: "Un autre compte utilise deja cet email." });
  }

  let assignedClubId = null;
  if (normalizedRole === "club_owner") {
    assignedClubId = clubIdValue || user.ownedClubId;
    if (!assignedClubId) {
      return res.status(400).json({ message: "Le club du responsable est obligatoire." });
    }
    const club = await getClubById(db, assignedClubId);
    if (!club) {
      return res.status(404).json({ message: "Club introuvable." });
    }
    const owner = await db.get("SELECT id FROM users WHERE ownedClubId = ? AND id <> ?", [assignedClubId, user.id]);
    if (owner) {
      return res.status(409).json({ message: "Ce club a deja un responsable." });
    }
  }

  const hash = password ? await bcrypt.hash(password, 10) : null;
  
  if (hash) {
    await db.run(
      "UPDATE users SET fullName = ?, email = ?, passwordHash = ?, role = ?, ownedClubId = ?, profilePicture = ? WHERE id = ?",
      [fullName, email, hash, normalizedRole, assignedClubId, profilePicture, user.id]
    );
  } else {
    await db.run(
      "UPDATE users SET fullName = ?, email = ?, role = ?, ownedClubId = ?, profilePicture = ? WHERE id = ?",
      [fullName, email, normalizedRole, assignedClubId, profilePicture, user.id]
    );
  }

  const updated = await getUserRecord(db, user.id);
  res.json({ message: "Compte mis a jour.", user: updated });
});

router.post("/formations", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { name, level, description } = req.body;
  if (!name || !level || !description) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO formations (name, level, description) VALUES (?, ?, ?)", [name, level, description]);
  const formation = await db.get("SELECT * FROM formations WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Formation ajoutee.", formation });
});

router.delete("/formations/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  await db.run("DELETE FROM formations WHERE id = ?", [req.params.id]);
  res.json({ message: "Formation supprimee." });
});

router.patch("/formations/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { name, level, description } = req.body;
  const db = await getDb();
  await db.run("UPDATE formations SET name = ?, level = ?, description = ? WHERE id = ?", [name, level, description, req.params.id]);
  const formation = await db.get("SELECT * FROM formations WHERE id = ?", [req.params.id]);
  res.json({ message: "Formation mise a jour.", formation });
});

router.post("/clubs", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { name, category, desc, img } = req.body;
  if (!name || !category || !desc) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO clubs (name, category, img, description) VALUES (?, ?, ?, ?)", [name, category, img || "photo/default-club.jpg", desc]);
  const club = await db.get("SELECT * FROM clubs WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Club ajoute.", club });
});

router.delete("/clubs/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  await db.run("DELETE FROM clubs WHERE id = ?", [req.params.id]);
  res.json({ message: "Club supprime." });
});

router.patch("/clubs/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { name, category, desc, img } = req.body;
  const db = await getDb();
  await db.run("UPDATE clubs SET name = ?, category = ?, img = ?, description = ? WHERE id = ?", [name, category, img, desc, req.params.id]);
  const club = await db.get("SELECT * FROM clubs WHERE id = ?", [req.params.id]);
  res.json({ message: "Club mis a jour.", club });
});

router.post("/events", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { title, date, location, organizer, desc, capacity } = req.body;
  if (!title || !date || !location || !organizer || !desc || !capacity) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run("INSERT INTO events (title, eventDate, location, organizer, description, capacity) VALUES (?, ?, ?, ?, ?, ?)", [title, date, location, organizer, desc, capacity]);
  const event = await db.get("SELECT * FROM events WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Evenement ajoute.", event });
});

router.delete("/events/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  await db.run("DELETE FROM events WHERE id = ?", [req.params.id]);
  res.json({ message: "Evenement supprime." });
});

router.patch("/events/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { title, date, location, organizer, desc, capacity } = req.body;
  const db = await getDb();
  await db.run("UPDATE events SET title = ?, eventDate = ?, location = ?, organizer = ?, description = ?, capacity = ? WHERE id = ?", [title, date, location, organizer, desc, capacity, req.params.id]);
  const event = await db.get("SELECT * FROM events WHERE id = ?", [req.params.id]);
  res.json({ message: "Evenement mis a jour.", event });
});

router.get("/registrations", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  const registrations = await db.all("SELECT * FROM registrations ORDER BY createdAt DESC");
  res.json({ registrations });
});

router.patch("/registrations/:id/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "Statut requis." });

  const db = await getDb();
  await db.run("UPDATE registrations SET status = ? WHERE id = ?", [status, req.params.id]);
  res.json({ message: "Statut mis a jour." });
});

router.post("/courses", async (req, res) => {
  if (!canManageContent(req)) {
    return res.status(403).json({ message: "Acces reserve aux enseignants et administrateurs." });
  }

  const { title, formation, teacher, description, link } = req.body;
  if (!title || !formation || !description) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const actor = await getUserRecord(db, req.auth.sub);
  const courseTeacher = teacher || (req.auth.role === "teacher" && actor ? actor.fullName : "");
  if (!courseTeacher) {
    return res.status(400).json({ message: "Le nom de l'enseignant est requis." });
  }

  const info = await db.run(
    "INSERT INTO courses (title, formation, teacher, description, link, createdByUserId) VALUES (?, ?, ?, ?, ?, ?)",
    [title, formation, courseTeacher, description, link || "https://drive.google.com/", req.auth.sub]
  );
  const course = await db.get("SELECT * FROM courses WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Cours ajoute.", course });
});

router.delete("/courses/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  await db.run("DELETE FROM courses WHERE id = ?", [req.params.id]);
  res.json({ message: "Cours supprime." });
});

router.patch("/courses/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { title, formation, teacher, description, link } = req.body;
  const db = await getDb();
  await db.run("UPDATE courses SET title = ?, formation = ?, teacher = ?, description = ?, link = ? WHERE id = ?", [title, formation, teacher, description, link, req.params.id]);
  const course = await db.get("SELECT * FROM courses WHERE id = ?", [req.params.id]);
  res.json({ message: "Cours mis a jour.", course });
});

router.post("/resources", async (req, res) => {
  if (!canManageContent(req)) {
    return res.status(403).json({ message: "Acces reserve aux enseignants et administrateurs." });
  }

  const { title, type, formation, description, link } = req.body;
  if (!title || !type || !formation || !description) return res.status(400).json({ message: "Champs requis." });

  const db = await getDb();
  const info = await db.run(
    "INSERT INTO resources (title, type, formation, description, link, createdByUserId) VALUES (?, ?, ?, ?, ?, ?)",
    [title, type, formation, description, link || "https://drive.google.com/", req.auth.sub]
  );
  const resource = await db.get("SELECT * FROM resources WHERE id = ?", [info.lastID]);
  res.status(201).json({ message: "Ressource ajoutee.", resource });
});

router.delete("/resources/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const db = await getDb();
  await db.run("DELETE FROM resources WHERE id = ?", [req.params.id]);
  res.json({ message: "Ressource supprimee." });
});

router.patch("/resources/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { title, type, formation, description, link } = req.body;
  const db = await getDb();
  await db.run("UPDATE resources SET title = ?, type = ?, formation = ?, description = ?, link = ? WHERE id = ?", [title, type, formation, description, link, req.params.id]);
  const resource = await db.get("SELECT * FROM resources WHERE id = ?", [req.params.id]);
  res.json({ message: "Ressource mise a jour.", resource });
});

module.exports = router;
