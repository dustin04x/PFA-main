const { getDb } = require('./db');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  const db = await getDb();

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS formations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      img TEXT,
      description TEXT NOT NULL,
      members INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clubAchievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clubId INTEGER NOT NULL,
      achievement TEXT NOT NULL,
      FOREIGN KEY(clubId) REFERENCES clubs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clubMemberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clubId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(clubId) REFERENCES clubs(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      eventDate TEXT NOT NULL,
      location TEXT NOT NULL,
      organizer TEXT NOT NULL,
      description TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      registered INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS eventRegistrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(eventId) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      cin TEXT UNIQUE NOT NULL,
      classe TEXT NOT NULL,
      email TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      formation TEXT NOT NULL,
      teacher TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      formation TEXT NOT NULL,
      description TEXT NOT NULL
    );
  `);

  // Seed Admin User
  const adminUser = await db.get("SELECT id FROM users WHERE email = 'admin@isitcom.rnu.tn'");
  if (!adminUser) {
    const hash = await bcrypt.hash('admin123', 10);
    await db.run(
      "INSERT INTO users (fullName, email, passwordHash, role) VALUES (?, ?, ?, ?)",
      ['Administrateur ISITCOM', 'admin@isitcom.rnu.tn', hash, 'admin']
    );
  }

  // Seed Formations
  const formationsCount = await db.get("SELECT COUNT(id) as count FROM formations");
  if (formationsCount.count === 0) {
    const formations = [
      ['Licence Multimédia', 'Licence', 'Développement web, UX/UI et médias numériques.'],
      ['Licence IoT', 'Licence', 'Objets connectés, systèmes embarqués et protocoles IoT.'],
      ['Licence Télécom', 'Licence', 'Réseaux, télécommunications et cybersécurité.'],
      ['Cycle Ingénieur', 'Ingénieur', 'Téléinformatique, cloud, IA, 5G et architecture réseau.'],
      ['Master', 'Master', 'Spécialisations en sécurité, web multimédia et data.'],
      ['Doctorat', 'Doctorat', 'Recherche en IA, IoT, cybersécurité et réseaux avancés.']
    ];
    for (const [name, level, desc] of formations) {
      await db.run("INSERT INTO formations (name, level, description) VALUES (?, ?, ?)", [name, level, desc]);
    }
  }

  // Seed Clubs
  const clubsCount = await db.get("SELECT COUNT(id) as count FROM clubs");
  if (clubsCount.count === 0) {
    const clubs = [
      ['ATAST ISITCOM', 'Technologies Avancées', 'photo/atast.jpg', 'Club des technologies avancées. Ateliers IoT, hackathons et projets IA appliqués.', 120],
      ['ARSII', 'Robotique & IA', 'photo/arsii.png', 'Association Robotique et Systèmes Intelligents. Drones, robotique mobile et IA embarquée.', 85],
      ['Google Developer Student Club', 'Technologies & Innovation', 'photo/google.png', 'Club officiel Google. Flutter, Android, cloud et événements tech communautaires.', 110],
      ['Radiocom Club', 'Télécommunications & Radio', 'photo/radiocom.jpg', 'Club radioamateur. SDR, transmission et ateliers de communication radio.', 45]
    ];
    let idx = 1;
    for (const [name, category, img, desc, members] of clubs) {
      await db.run("INSERT INTO clubs (name, category, img, description, members) VALUES (?, ?, ?, ?, ?)", [name, category, img, desc, members]);
      // Achievements mapping to UI design
      if (idx === 1) await db.run("INSERT INTO clubAchievements (clubId, achievement) VALUES (?, ?)", [idx, 'Best Club 2025']);
      if (idx === 2) await db.run("INSERT INTO clubAchievements (clubId, achievement) VALUES (?, ?)", [idx, 'Finaliste RoboCup 2025']);
      if (idx === 3) await db.run("INSERT INTO clubAchievements (clubId, achievement) VALUES (?, ?)", [idx, 'Google I/O Extended 2025']);
      if (idx === 4) await db.run("INSERT INTO clubAchievements (clubId, achievement) VALUES (?, ?)", [idx, 'Station radio amateur']);
      idx++;
    }
  }

  // Seed Events
  const eventsCount = await db.get("SELECT COUNT(id) as count FROM events");
  if (eventsCount.count === 0) {
    const events = [
      ["Nuit de l'Info 2026", "2026-11-15", "Grand Amphi", "ATAST", "Hackathon national de 24h", 150, 78],
      ["Journée Portes Ouvertes", "2026-03-28", "Hall principal", "ISITCOM", "Découverte des formations", 300, 210],
      ["Conférence IA & Smart Cities", "2026-04-05", "LabTIC", "ARSII", "IA appliquée aux villes intelligentes", 100, 52]
    ];
    for (const [title, date, loc, org, desc, cap, reg] of events) {
      await db.run("INSERT INTO events (title, eventDate, location, organizer, description, capacity, registered) VALUES (?, ?, ?, ?, ?, ?, ?)", [title, date, loc, org, desc, cap, reg]);
    }
  }

  // Seed Courses
  const coursesCount = await db.get("SELECT COUNT(id) as count FROM courses");
  if (coursesCount.count === 0) {
    const courses = [
      ["Développement Front-End React", "Multimédia", "Dr. Ben Ali", "Composants, ergonomie d'interface, états et intégration API."],
      ["Architecture IoT et MQTT", "IoT", "Pr. Mansouri", "Capteurs, passerelles, protocoles temps réel et tableaux de bord."],
      ["Réseaux 5G et Sécurité", "Télécom", "Dr. Khelil", "Réseaux mobiles, sécurité des flux et supervision."],
      ["UX Writing et Design Systems", "Multimédia", "Mme Trabelsi", "Microcopie, composants réutilisables et cohérence produit."]
    ];
    for (const [title, form, teacher, desc] of courses) {
      await db.run("INSERT INTO courses (title, formation, teacher, description) VALUES (?, ?, ?, ?)", [title, form, teacher, desc]);
    }
  }

  // Seed Resources
  const resourcesCount = await db.get("SELECT COUNT(id) as count FROM resources");
  if (resourcesCount.count === 0) {
    const resources = [
      ["Cours React Complet", "Cours", "Multimédia", "Support de cours, TP et mini-projet de synthèse."],
      ["Examen IoT 2025", "Examen", "IoT", "Sujet, grille d'évaluation et corrigé détaillé."],
      ["PFE Cybersécurité 5G", "PFE", "Télécom", "Rapport complet sur la sécurisation d'un cœur de réseau."],
      ["Guide du livret étudiant", "Guide", "Général", "Informations académiques, calendrier et contacts utiles."]
    ];
    for (const [title, type, form, desc] of resources) {
      await db.run("INSERT INTO resources (title, type, formation, description) VALUES (?, ?, ?, ?)", [title, type, form, desc]);
    }
  }

  console.log("Base de données SQLite initialisée avec succès !");
}

module.exports = { initializeDatabase };
