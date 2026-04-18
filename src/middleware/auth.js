const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "isitcom_secret_key_2026";

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentification requise." });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expirée. Reconnectez-vous." });
  }
}

function adminRequired(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ message: "Accès réservé aux administrateurs." });
  }
  next();
}

module.exports = { authRequired, adminRequired, JWT_SECRET };
