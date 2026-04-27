const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("../database/db");
const { authRequired, JWT_SECRET } = require("../middleware/auth");

router.post("/register", async (_req, res) => {
  res.status(403).json({
    message: "L'inscription publique est desactivee. Les comptes sont crees par l'administration."
  });
});

function formatUser(user) {
  return {
    id: user.id,
    fullName: user.fullName || user.fullname,
    email: user.email,
    role: user.role,
    ownedClubId: user.ownedClubId ?? user.ownedclubid ?? null,
    ownedClubName: user.clubName || user.clubname || null,
    createdAt: user.createdAt || user.createdat
  };
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis." });

  try {
    const db = await getDb();
    const user = await db.get(`
      SELECT u.id, u.fullName, u.email, u.passwordHash, u.role, u.ownedClubId, u.createdAt, c.name AS clubName
      FROM users u
      LEFT JOIN clubs c ON c.id = u.ownedClubId
      WHERE u.email = ?
    `, [email]);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Identifiants incorrects." });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Connexion reussie.",
      token,
      user: formatUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/me", authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get(`
      SELECT u.id, u.fullName, u.email, u.role, u.ownedClubId, u.createdAt, c.name AS clubName
      FROM users u
      LEFT JOIN clubs c ON c.id = u.ownedClubId
      WHERE u.id = ?
    `, [req.auth.sub]);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    res.json({ user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
