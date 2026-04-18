const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("../database/db");
const { authRequired, JWT_SECRET } = require("../middleware/auth");

router.post("/register", async (req, res) => {
  const obj = req.body;
  if (!obj.fullName || !obj.email || !obj.password) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }
  if (obj.password.length < 6) {
    return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères." });
  }

  try {
    const db = await getDb();
    const exists = await db.get("SELECT id FROM users WHERE email = ?", [obj.email]);
    if (exists) {
      return res.status(409).json({ message: "Un compte existe déjà avec cet email." });
    }

    const hash = await bcrypt.hash(obj.password, 10);
    const result = await db.run(
      "INSERT INTO users (fullName, email, passwordHash) VALUES (?, ?, ?)",
      [obj.fullName, obj.email, hash]
    );

    const user = { id: result.lastID, fullName: obj.fullName, email: obj.email, role: 'student' };
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ message: "Compte créé.", token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis." });

  try {
    const db = await getDb();
    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Identifiants incorrects." });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Connexion réussie.",
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.get("/me", authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get("SELECT id, fullName, email, role, createdAt FROM users WHERE id = ?", [req.auth.sub]);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
