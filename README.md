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
- **Backend Environment**: Node.js utilizing the Express 5.x framework.
- **Database**: **PostgreSQL 15** for reliable relational data management.
- **Security**: 
    - **JWT (JSON Web Tokens)** for session management.
    - **Bcryptjs** for cryptographic password hashing.
    - **Helmet.js** for secure HTTP headers.
    - **Express Rate Limit** for brute-force protection.
- **Containerization**: **Docker** & **Docker Compose** for seamless environment orchestration.

### Code Organization
```text
├── assets/          # Frontend logic (app.js) and CSS styling (style.css)
├── photo/           # Publicly served images
├── src/
│   ├── database/    # PostgreSQL Connection & Automated Table/Seed Initialization
│   ├── middleware/  # JWT Authentication & Security Handlers
│   └── routes/      # Modular Domain Routing (Auth, Admin, Student, Public)
├── data/            # Local directory for persistent database volumes
├── server.js        # Core Web Server Application Entrypoint
├── Dockerfile       # Application container definition
└── docker-compose.yml # Service orchestration (App + Database)
```

---

## Installation & Startup Guide

### 1. Prerequisites
- **Node.js** v20+ (if running locally)
- **Docker & Docker Compose** (Recommended)
- **PostgreSQL 15** (if running without Docker)

### 2. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
PORT=3000
JWT_SECRET=your_super_secret_key
POSTGRES_USER=isitcom_admin
POSTGRES_PASSWORD=isitcom_secure_password
POSTGRES_DB=isitcom_db
POSTGRES_HOST=localhost # Use 'postgres' if running via Docker
POSTGRES_PORT=5432
```

### 3. Launching with Docker (Recommended)
The easiest way to start the entire stack including the database:
```bash
docker-compose up --build
```

### 4. Manual Local Launch
If you prefer running the backend manually:
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start the Server**:
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```
*The database schema and demo data will automatically initialize upon first connection.*

Navigate to: `http://localhost:3000`

### 5. Demo Login Credentials
To test the full capability of the administrative dashboard:
- **Email**: `admin@isitcom.rnu.tn`
- **Password**: `admin123`

---

## API References

The backend securely exposes a `REST` API structured under `/api` routes:
- `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- `/api/admin/overview`, `/api/admin/settings` (Protected)
- `/api/me/activity` (Protected Student Status)
- `/api/formations`, `/api/clubs`, `/api/events` (Read Only Public)
