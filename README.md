# ISITCOM EduConnect Platform 🎓

Welcome to the **ISITCOM** (Institut Supérieur d'Informatique et des Technologies de Communication) University website. This platform provides students, prospective students, and administrators with a modern, dynamic, and fully integrated ecosystem for managing university life.

## Features

### 🌟 Public Portal
- **Formations**: Discover detailed information regarding Licences, Master's degrees, Engineering cycles, and Doctorates.
- **Campus Life & Clubs**: Explore the diverse student organizations (ATAST, ARSII, GDSC, etc.).
- **Events (Agenda)**: Stay updated on hackathons, seminars, and open days.
- **Resources**: Access courses, exam archives, and academic guidelines directly.

### 🔐 Student Dashboard
- **Authentication**: Secure JWT-based registration and login system.
- **Club Memberships**: Apply to join specific technology clubs.
- **Event Registrations**: Reserve seats for limited-capacity events securely.
- **My Activity**: Personalized dashboard showing active club memberships and upcoming registered events.

### ⚙️ Administrative Console
- **Platform Analytics**: Instantly monitor total users, active formations, clubs, and overall ecosystem volume.
- **Content Management**: Dynamically Add, Edit, or Delete Formations, Clubs, and Events via a secure REST API.
- **Administrative Privileges**: Only authorized administrative accounts can mutate the platform architecture.

---

## Technical Stack Architecture

The application implements a robust, deeply modernized MVC-style architecture.

- **Frontend**: Responsive HTML5, modular Vanilla CSS, and modern asynchronous JavaScript (`app.js`).
- **Backend Environment**: Node.js utilizing the Express.js framework.
- **Database**: Zero-dependency **SQLite** implementation utilizing Node 22.5+ native `node:sqlite` for raw, blisteringly fast SQL relational transactions.
- **Security**: JWT (JSON Web Tokens) for session management alongside `bcryptjs` for cryptographic password hashing.

### Code Organization
```text
├── assets/          # Frontend logic (app.js) and CSS styling (style.css)
├── photo/           # Publicly served images
├── src/
│   ├── database/    # SQLite Connection & Automated Table/Seed Initialization
│   ├── middleware/  # JWT Authentication Handlers
│   └── routes/      # Modular Domain Routing (Auth, Admin, Student, Public)
├── data/            # Local directory where SQLite saves database.sqlite
├── server.js        # Core Web Server Application Entrypoint
```

---

## Installation & Startup Guide

### 1. Requirements
Ensure you are running an environment compatible directly with built-in SQLite:
- **Node.js** v22.5.0 or higher.

### 2. Install Dependencies
Run the installation script to grab the minimal requirements (Express, JWT, bcrypt):
```bash
npm install
```

### 3. Launching the Platform
Start the backend server on your machine:
```bash
npm start
```
*The database (`database.sqlite`) will automatically initialize and securely seed its schema and initial demo data if it did not exist.*

Navigate to: `http://localhost:3000`

### 4. Demo Login Credentials
To test the full capability of the administrative dashboard, use the pre-seeded admin account:
- **Email**: `admin@isitcom.rnu.tn`
- **Password**: `admin123`

---

## API References

The backend securely exposes a `REST` API structured under `/api` routes:
- `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- `/api/admin/overview`, `/api/admin/settings` (Protected)
- `/api/me/activity` (Protected Student Status)
- `/api/formations`, `/api/clubs`, `/api/events` (Read Only Public)
