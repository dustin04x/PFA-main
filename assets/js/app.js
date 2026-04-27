const authTokenKey = "isitcomAuthToken";

const state = {
  user: null,
  formations: [],
  clubs: [],
  events: [],
  courses: [],
  resources: [],
  registrations: [],
  activity: { clubs: [], events: [] },
  allUsers: [],
  ownerRequests: [],
  userSearch: "",
  toastTimer: null
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function qs(selector) { return document.querySelector(selector); }
function qsa(selector) { return Array.from(document.querySelectorAll(selector)); }
function getToken() { return localStorage.getItem(authTokenKey); }

function setSession(token, user) {
  localStorage.setItem(authTokenKey, token);
  state.user = user;
}

function clearSession() {
  localStorage.removeItem(authTokenKey);
  state.user = null;
  state.activity = { clubs: [], events: [] };
  state.allUsers = [];
  state.ownerRequests = [];
  state.userSearch = "";
}

function isAdmin() { return state.user?.role === "admin"; }
function isTeacher() { return state.user?.role === "teacher"; }
function isClubOwner() { return state.user?.role === "club_owner"; }
function roleLabel(role) {
  if (role === "admin") return "Administrateur";
  if (role === "teacher") return "Enseignant";
  if (role === "club_owner") return "Responsable club";
  if (role === "student") return "Etudiant";
  return role || "Compte";
}

async function apiRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Une erreur est survenue.");
  return data;
}

function showToast(message, tone = "default") {
  let toast = qs(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  const icon = tone === "danger" ? "fa-circle-xmark" : tone === "success" ? "fa-circle-check" : "fa-circle-info";
  toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  toast.style.borderColor = tone === "danger" ? "rgba(200,75,49,0.2)" : tone === "success" ? "rgba(31,143,95,0.2)" : "rgba(23,50,77,0.08)";
  toast.style.background = tone === "danger" ? "#fff4f1" : tone === "success" ? "#f0faf6" : "#ffffff";
  toast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3800);
}

function formatCount(n) { return new Intl.NumberFormat("fr-FR").format(n); }

function formatDate(str) {
  if (!str) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(str));
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

function setActiveNav() {
  const page = document.body.dataset.page;
  qsa("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === page));
}

function setupNavigation() {
  setActiveNav();
  const toggle = qs("[data-nav-toggle]");
  const menu = qs("[data-nav-menu]");
  if (toggle && menu) toggle.addEventListener("click", () => menu.classList.toggle("is-open"));
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function setupTabs() {
  qsa(".portal-tabs").forEach(tabBar => {
    tabBar.addEventListener("click", e => {
      const btn = e.target.closest(".tab-btn");
      if (!btn || !btn.dataset.tab) return;
      const targetId = btn.dataset.tab;
      const section = tabBar.closest("section") || tabBar.closest(".container") || document.body;
      tabBar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      section.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add("active");
    });
  });
}

// ─── THEME ──────────────────────────────────────────────────────────────────

function setupGlobalEvents() {
  const themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
}

function initTheme() {
  const saved = localStorage.getItem('isitcom-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const icon = document.querySelector('[data-theme-toggle] i');
    if (icon) icon.className = 'fas fa-sun';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const icon = document.querySelector('[data-theme-toggle] i');
  
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('isitcom-theme', 'light');
    if (icon) icon.className = 'fas fa-moon';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('isitcom-theme', 'dark');
    if (icon) icon.className = 'fas fa-sun';
  }
}

// ─── AUTH CHIPS ───────────────────────────────────────────────────────────────

function updateAuthChips() {
  qsa("[data-auth-chip]").forEach(chip => {
    chip.textContent = state.user ? state.user.fullName : "Accès visiteur";
  });
}

// ─── PORTAL VISIBILITY ────────────────────────────────────────────────────────

function updatePortalState() {
  updateAuthChips();
  const sectionGuest = qs("[data-section-guest]");
  const sectionStudent = qs("[data-section-student]");
  const sectionOwner = qs("[data-section-owner]");
  const sectionTeacher = qs("[data-section-teacher]");
  const sectionAdmin = qs("[data-section-admin]");

  if (!sectionGuest) return;

  if (!state.user) {
    sectionGuest.hidden = false;
    if (sectionStudent) sectionStudent.hidden = true;
    if (sectionOwner) sectionOwner.hidden = true;
    if (sectionTeacher) sectionTeacher.hidden = true;
    if (sectionAdmin) sectionAdmin.hidden = true;
    return;
  }

  sectionGuest.hidden = true;

  if (isAdmin()) {
    if (sectionStudent) sectionStudent.hidden = true;
    if (sectionOwner) sectionOwner.hidden = true;
    if (sectionTeacher) sectionTeacher.hidden = true;
    if (sectionAdmin) {
      sectionAdmin.hidden = false;
      loadAdminData();
    }
  } else if (isTeacher()) {
    if (sectionStudent) sectionStudent.hidden = true;
    if (sectionOwner) sectionOwner.hidden = true;
    if (sectionAdmin) sectionAdmin.hidden = true;
    if (sectionTeacher) {
      sectionTeacher.hidden = false;
      renderTeacherDashboard();
      loadTeacherData();
    }
  } else if (isClubOwner()) {
    if (sectionStudent) sectionStudent.hidden = true;
    if (sectionTeacher) sectionTeacher.hidden = true;
    if (sectionAdmin) sectionAdmin.hidden = true;
    if (sectionOwner) {
      sectionOwner.hidden = false;
      const welcome = qs("#owner-welcome");
      if (welcome) welcome.textContent = `Bonjour, ${state.user.fullName} !`;
      const clubLabel = qs("[data-owned-club-label]");
      if (clubLabel) clubLabel.textContent = state.user.ownedClubName || "Club non rattache";
      renderUserDashboard(qs("[data-owner-dashboard]"));
      renderOwnerRequests();
      loadOwnerRequests();
    }
  } else {
    if (sectionStudent) {
      sectionStudent.hidden = false;
      const welcome = qs("#student-welcome");
      if (welcome) welcome.textContent = `Bonjour, ${state.user.fullName} !`;
      renderUserDashboard(qs("[data-user-dashboard]"));
    }
    if (sectionOwner) sectionOwner.hidden = true;
    if (sectionTeacher) sectionTeacher.hidden = true;
    if (sectionAdmin) sectionAdmin.hidden = true;
  }
}

// ─── SESSION HYDRATION ────────────────────────────────────────────────────────

async function hydrateSession() {
  const token = getToken();
  if (!token) { updatePortalState(); return; }
  try {
    const data = await apiRequest("/api/auth/me");
    state.user = data.user;
    if (state.user) await loadUserActivity();
  } catch (_) {
    clearSession();
  }
  updatePortalState();
}

// ─── USER ACTIVITY ────────────────────────────────────────────────────────────

async function loadUserActivity() {
  if (!state.user) return;
  try {
    const data = await apiRequest("/api/me/activity");
    state.activity = data;
  } catch (e) {
    console.warn("Activité non chargée:", e.message);
  }
}

function renderUserDashboard(target = null) {
  const dashboard = target || qs("[data-user-dashboard]");
  if (!dashboard || !state.user) return;

  const clubRows = state.activity.clubs.length === 0
    ? `<div class="empty-state">
         <i class="fas fa-users"></i>
         <span>Vous n'avez rejoint aucun club pour l'instant.</span>
         <a href="campus.html" class="button-ghost" style="margin-top:.6rem;padding:.6rem 1.1rem;border-radius:999px;border:1px solid var(--line)">Explorer les clubs</a>
       </div>`
    : state.activity.clubs.map(m => `
        <article class="content-card" style="padding:1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
            <div>
              <span class="card-label">${m.club ? m.club.category : "Club"}</span>
              <h3 style="margin:.4rem 0 0;font-size:1.05rem">${m.club ? m.club.name : "—"}</h3>
            </div>
            <span class="badge ${m.status === 'pending' ? 'badge-status-pending' : 'badge-level'}">
              ${m.status === 'pending' ? '<i class="fas fa-clock"></i> En attente' : '<i class="fas fa-check"></i> Membre'}
            </span>
          </div>
        </article>`).join("");

  const eventRows = state.activity.events.length === 0
    ? `<div class="empty-state">
         <i class="fas fa-calendar-days"></i>
         <span>Vous n'êtes inscrit à aucun événement.</span>
         <a href="events.html" class="button-ghost" style="margin-top:.6rem;padding:.6rem 1.1rem;border-radius:999px;border:1px solid var(--line)">Voir l'agenda</a>
       </div>`
    : state.activity.events.map(r => `
        <article class="content-card" style="padding:1rem">
          <span class="resource-tag"><i class="fas fa-calendar-check"></i> Inscrit</span>
          <h3 style="margin:.5rem 0 .4rem;font-size:1.05rem">${r.event ? r.event.title : "—"}</h3>
          <div class="event-meta">
            <span><i class="fas fa-calendar"></i> ${r.event ? formatDate(r.event.date) : "—"}</span>
            <span><i class="fas fa-map-marker-alt"></i> ${r.event ? r.event.location : "—"}</span>
          </div>
        </article>`).join("");

  const regInfo = state.activity.registrationInfo;
  const regWidget = regInfo 
    ? `<div style="margin-bottom: 2rem;">
        <h3 style="font-family:'Space Grotesk',sans-serif;margin:0 0 1rem;display:flex;align-items:center;gap:.5rem">
          <i class="fas fa-folder-open"></i> Mon Dossier
        </h3>
        <article class="content-card" style="padding:1rem; border-left: 4px solid var(--brand);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
            <div>
              <span class="card-label">${regInfo.classe}</span>
              <h3 style="margin:.4rem 0 0;font-size:1.05rem">${regInfo.prenom} ${regInfo.nom}</h3>
            </div>
            <span class="badge ${regInfo.status === 'Validé' ? 'badge-role-admin' : (regInfo.status === 'Rejeté' ? 'badge-status-full' : 'badge-level')}">
              ${regInfo.status || 'En attente'}
            </span>
          </div>
        </article>
       </div>` : '';

  dashboard.innerHTML = `
    ${regWidget}
    <div class="grid-2">
      <div>
        <h3 style="font-family:'Space Grotesk',sans-serif;margin:0 0 1rem;display:flex;align-items:center;gap:.5rem">
          <i class="fas fa-users"></i> Mes clubs
        </h3>
        <div style="display:grid;gap:.8rem">${clubRows}</div>
      </div>
      <div>
        <h3 style="font-family:'Space Grotesk',sans-serif;margin:0 0 1rem;display:flex;align-items:center;gap:.5rem">
          <i class="fas fa-calendar-alt"></i> Mes événements
        </h3>
        <div style="display:grid;gap:.8rem">${eventRows}</div>
      </div>
    </div>`;
}

async function loadOwnerRequests() {
  if (!state.user || !isClubOwner()) return;
  try {
    const data = await apiRequest("/api/club-owner/requests");
    state.ownerRequests = data.requests || [];
    renderOwnerRequests();
  } catch (e) {
    console.warn("Demandes club non chargees:", e.message);
  }
}

function renderOwnerRequests() {
  const wrap = qs("[data-owner-requests]");
  if (!wrap || !state.user || !isClubOwner()) return;

  if (!state.ownerRequests.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-users-check"></i><span>Aucune demande en attente pour ce club.</span></div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Etudiant</th><th>Email</th><th>Date</th><th>Statut</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${state.ownerRequests.map(req => `
          <tr>
            <td><strong>${req.fullName}</strong></td>
            <td style="color:var(--muted)">${req.email}</td>
            <td style="color:var(--muted);white-space:nowrap">${formatDate(req.createdAt)}</td>
            <td><span class="badge ${req.status === 'accepted' ? 'badge-role-admin' : req.status === 'rejected' ? 'badge-status-full' : 'badge-status-pending'}">${req.status}</span></td>
            <td>
              ${req.status === "pending" ? `
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                  <button class="button" style="padding:.4rem .8rem;font-size:.85rem" data-owner-request-action="${req.id}" data-owner-status="accepted">
                    <i class="fas fa-check"></i>
                  </button>
                  <button class="button-danger" style="padding:.4rem .8rem;font-size:.85rem" data-owner-request-action="${req.id}" data-owner-status="rejected">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              ` : `<span style="color:var(--muted)">Traitee</span>`}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function renderTeacherDashboard() {
  const title = qs("[data-teacher-title]");
  if (title && state.user) title.textContent = `Bonjour, ${state.user.fullName} !`;
  const courseTable = qs("[data-teacher-courses-table]");
  const resourceTable = qs("[data-teacher-resources-table]");
  if (courseTable) renderCoursesTable(courseTable, false);
  if (resourceTable) renderResourcesTable(resourceTable, false);
}

function loadTeacherData() {
  if (!isTeacher()) return;
  renderTeacherDashboard();
}

// ─── PUBLIC CARD RENDERS ──────────────────────────────────────────────────────

function renderFormationCards(targets) {
  if (!targets.length) return;
  const html = state.formations.map(f => `
    <article class="content-card">
      <span class="card-label">${f.level}</span>
      <h3>${f.name}</h3>
      <p>${f.description}</p>
    </article>`).join("") ||
    `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-graduation-cap"></i><span>Aucune formation disponible.</span></div>`;
  targets.forEach(t => { t.innerHTML = html; });

  const sel = qs("[data-formation-select]");
  if (sel) {
    sel.innerHTML = `<option value="">Sélectionnez votre formation</option>` +
      state.formations.map(f => `<option value="${f.name}">${f.name}</option>`).join("");
  }
}

function renderClubCards(targets, limit) {
  if (!targets.length) return;
  const source = limit ? state.clubs.slice(0, limit) : state.clubs;
  const html = source.map(club => `
    <article class="content-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <span class="card-label">${club.category}</span>
        <a href="https://www.instagram.com/" target="_blank" class="social-icon-link" title="Suivre sur Instagram" style="color: #E1306C; font-size: 1.1rem;">
          <i class="fab fa-instagram"></i>
        </a>
      </div>
      ${club.img ? `<img src="${club.img}" alt="${club.name}" style="border-radius:18px;height:200px;width:100%;object-fit:cover;margin-top:1rem;margin-bottom:1rem">` : ""}
      <h3>${club.name}</h3>
      <p>${club.desc}</p>
      <div class="meta-row">
        <span><i class="fas fa-users"></i> ${formatCount(club.members)} membres</span>
        ${club.achievements && club.achievements[0] ? `<span><i class="fas fa-trophy"></i> ${club.achievements[0]}</span>` : ""}
      </div>
      <div class="hero-actions" style="margin-top:1rem">
        <button class="button-secondary" type="button" data-club-join="${club.id}">
          <i class="fas fa-user-plus"></i> Rejoindre
        </button>
      </div>
    </article>`).join("") ||
    `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users"></i><span>Aucun club disponible.</span></div>`;
  targets.forEach(t => { t.innerHTML = html; });
}

function renderEventCards(targets, limit) {
  if (!targets.length) return;
  const source = limit ? state.events.slice(0, limit) : state.events;
  const html = source.map(ev => {
    const spots = ev.capacity - ev.registered;
    const full = spots <= 0;
    return `
    <article class="timeline-card" style="padding:1.35rem">
      <span class="resource-tag"><i class="fas fa-building"></i> ${ev.organizer}</span>
      <h3 style="margin:.6rem 0 .4rem;font-family:'Space Grotesk',sans-serif;font-size:1.2rem">${ev.title}</h3>
      <p style="margin:0 0 .8rem;color:var(--muted)">${ev.desc}</p>
      <div class="event-meta">
        <span><i class="fas fa-calendar"></i> ${formatDate(ev.date)}</span>
        <span><i class="fas fa-map-marker-alt"></i> ${ev.location}</span>
        <span class="${full ? 'badge-status-full' : 'badge-level'}" style="padding:.25rem .65rem;border-radius:999px;font-size:.8rem;font-weight:700">
          ${full ? "Complet" : spots + " place" + (spots > 1 ? "s" : "") + " restante" + (spots > 1 ? "s" : "")}
        </span>
      </div>
      <div class="hero-actions" style="margin-top:1rem">
        <button class="button" type="button" data-event-register="${ev.id}" ${full ? 'disabled style="opacity:.5;cursor:not-allowed"' : ""}>
          <i class="fas fa-check-circle"></i> S'inscrire
        </button>
      </div>
    </article>`;
  }).join("") ||
    `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-calendar-days"></i><span>Aucun événement planifié.</span></div>`;
  targets.forEach(t => { t.innerHTML = html; });
}

function renderHomeMetrics() {
  const u = qs("[data-stat-users]");
  const f = qs("[data-stat-formations]");
  const c = qs("[data-stat-clubs]");
  if (f) f.setAttribute("data-stat-counter", state.formations.length || 6);
  if (c) c.setAttribute("data-stat-counter", state.clubs.length || 4);
  if (u) {
    u.setAttribute("data-stat-counter", 1800);
    u.dataset.suffix = "+";
  }
}

function renderCourses() {
  const grid = qs("[data-course-grid]");
  if (!grid) return;
  const search = (qs("[data-course-search]")?.value || "").toLowerCase();
  const formation = qs("[data-course-filter]")?.value || "all";
  const filtered = state.courses.filter(c => {
    const txt = [c.title, c.teacher, c.description].join(" ").toLowerCase();
    return txt.includes(search) && (formation === "all" || c.formation === formation);
  });
  grid.innerHTML = filtered.map(c => `
    <article class="resource-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <span class="resource-tag">${c.formation}</span>
        <a href="${c.link || 'https://drive.google.com/'}" target="_blank" class="social-icon-link" title="Consulter sur Google Drive" style="color: #34A853; font-size: 1.1rem;">
          <i class="fab fa-google-drive"></i>
        </a>
      </div>
      <h3>${c.title}</h3>
      <p>${c.description}</p>
      <div class="meta-row">
        <span><i class="fas fa-chalkboard-teacher"></i> ${c.teacher}</span>
      </div>
    </article>`).join("") ||
    `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-search"></i><span>Aucun cours trouvé.</span></div>`;
}

function renderResources() {
  const grid = qs("[data-resource-grid]");
  if (!grid) return;
  grid.innerHTML = state.resources.map(r => `
    <article class="resource-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <span class="resource-tag">${r.type}</span>
        <a href="${r.link || 'https://drive.google.com/'}" target="_blank" class="social-icon-link" title="Consulter sur Google Drive" style="color: #34A853; font-size: 1.1rem;">
          <i class="fab fa-google-drive"></i>
        </a>
      </div>
      <h3>${r.title}</h3>
      <p>${r.description}</p>
      <div class="meta-row">
        <span><i class="fas fa-folder-open"></i> ${r.formation}</span>
      </div>
    </article>`).join("") ||
    `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-file-alt"></i><span>Aucun document disponible.</span></div>`;
}

function renderCalendar() {
  const el = qs("#calendar");
  if (!el || typeof FullCalendar === "undefined") return;
  el.innerHTML = "";
  const cal = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    locale: "fr",
    height: 580,
    headerToolbar: { left: "prev,next today", center: "title", right: "" },
    events: state.events.map(ev => ({ title: ev.title, start: ev.date, color: "#0f766e" }))
  });
  cal.render();
}

// ─── ADMIN DATA ───────────────────────────────────────────────────────────────

async function loadAdminData() {
  try {
    const [statsData, usersData, regsData] = await Promise.all([
      apiRequest("/api/admin/overview"),
      apiRequest("/api/admin/users"),
      apiRequest("/api/admin/registrations")
    ]);
    renderAdminMetrics(statsData.stats);
    state.allUsers = usersData.users;
    state.registrations = regsData.registrations;
    renderAdminTables();
  } catch (e) {
    showToast("Erreur lors du chargement des données.", "danger");
  }
}

function renderAdminMetrics(stats) {
  const grid = qs("[data-admin-metrics]");
  if (!grid) return;
  grid.innerHTML = `
    <article class="metric-card">
      <strong>${formatCount(stats.users)}</strong>
      <h3>Utilisateurs</h3><p>Comptes enregistrés</p>
    </article>
    <article class="metric-card">
      <strong>${formatCount(stats.formations)}</strong>
      <h3>Formations</h3><p>Programmes actifs</p>
    </article>
    <article class="metric-card">
      <strong>${formatCount(stats.clubs)}</strong>
      <h3>Clubs</h3><p>Associations étudiantes</p>
    </article>
    <article class="metric-card">
      <strong>${formatCount(stats.events)}</strong>
      <h3>Événements</h3><p>Activités planifiées</p>
    </article>`;
}

function renderAdminTables() {
  renderFormationsTable();
  renderCoursesTable("[data-courses-table]", true);
  renderResourcesTable("[data-resources-table]", true);
  renderClubsTable();
  renderEventsTable();
  renderRegistrationsTable();
  renderUsersTable();
  populateClubSelects();
}

function renderFormationsTable() {
  const wrap = qs("[data-formations-table]");
  if (!wrap) return;
  if (!state.formations.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-graduation-cap"></i><span>Aucune formation enregistrée.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Intitulé</th><th>Niveau</th><th>Description</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${state.formations.map(f => `
          <tr>
            <td><strong>${f.name}</strong></td>
            <td><span class="badge badge-level">${f.level}</span></td>
            <td style="color:var(--muted);max-width:260px;font-size:.93rem">${f.description}</td>
            <td>
              <div style="display:flex;gap:0.5rem">
                <button class="button-warning" data-edit-formation="${f.id}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="button-danger" data-delete-formation="${f.id}">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderClubsTable() {
  const wrap = qs("[data-clubs-table]");
  if (!wrap) return;
  if (!state.clubs.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><span>Aucun club enregistré.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Nom</th><th>Catégorie</th><th>Membres</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${state.clubs.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><span class="badge badge-category">${c.category}</span></td>
            <td>${formatCount(c.members)}</td>
            <td>
              <div style="display:flex;gap:0.5rem">
                <button class="button-warning" data-edit-club="${c.id}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="button-danger" data-delete-club="${c.id}">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderEventsTable() {
  const wrap = qs("[data-events-table]");
  if (!wrap) return;
  if (!state.events.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-days"></i><span>Aucun événement planifié.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Titre</th><th>Date</th><th>Lieu</th><th>Inscriptions</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${state.events.map(ev => {
          const full = ev.registered >= ev.capacity;
          return `
          <tr>
            <td>
              <strong>${ev.title}</strong><br>
              <span style="color:var(--muted);font-size:.86rem">${ev.organizer}</span>
            </td>
            <td style="white-space:nowrap">${formatDate(ev.date)}</td>
            <td>${ev.location}</td>
            <td>
              <span class="badge ${full ? "badge-status-full" : "badge-level"}">
              ${ev.registered} / ${ev.capacity}
              </span>
              </td>
              <td>
              <div style="display:flex;gap:0.5rem">
              <button class="button-warning" data-edit-event="${ev.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="button-danger" data-delete-event="${ev.id}">
                <i class="fas fa-trash-alt"></i>
              </button>
              </div>
              </td>
              </tr>`;

        }).join("")}
      </tbody>
    </table>`;
}

function renderUsersTable() {
  const wrap = qs("[data-users-table]");
  if (!wrap) return;
  const search = state.userSearch.trim().toLowerCase();
  const users = search
    ? state.allUsers.filter(u => [u.fullName, u.email, u.role, u.clubName || ""].join(" ").toLowerCase().includes(search))
    : state.allUsers;

  if (!users.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-user-cog"></i><span>Aucun utilisateur enregistré.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Profil</th><th>Nom complet</th><th>Email</th><th>Role</th><th>Club</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>
              <img src="${u.profilePicture || 'photo/face.jpg'}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--line)">
            </td>
            <td><strong>${u.fullName}</strong></td>
            <td style="color:var(--muted)">${u.email}</td>
            <td><span class="badge ${u.role === "admin" ? "badge-role-admin" : (u.role === "teacher" ? "badge-role-teacher" : (u.role === "club_owner" ? "badge-role-owner" : "badge-role-student"))}">
              ${roleLabel(u.role)}
            </span></td>
            <td style="color:var(--muted)">${u.clubName || "—"}</td>
            <td>
              <button class="button-warning" data-edit-user="${u.id}">
                <i class="fas fa-edit"></i>
              </button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function populateClubSelects() {
  const selects = qsa("[data-user-club-select]");
  if (!selects.length) return;
  const options = `<option value="">Aucun club</option>` + state.clubs.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  selects.forEach(sel => { sel.innerHTML = options; });
}

function renderCoursesTable(target = null, editable = true) {
  const wrap = typeof target === "string" ? qs(target) : (target || qs("[data-courses-table]"));
  if (!wrap) return;
  if (!state.courses.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-book"></i><span>Aucun cours enregistré.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Titre</th><th>Formation</th><th>Enseignant</th>${editable ? "<th>Action</th>" : ""}
      </tr></thead>
      <tbody>
        ${state.courses.map(c => `
          <tr>
            <td><strong>${c.title}</strong></td>
            <td><span class="badge badge-level">${c.formation}</span></td>
            <td style="color:var(--muted)">${c.teacher}</td>
            ${editable ? `<td>
              <div style="display:flex;gap:0.5rem">
                <button class="button-warning" data-edit-course="${c.id}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="button-danger" data-delete-course="${c.id}">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </td>` : ""}
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderResourcesTable(target = null, editable = true) {
  const wrap = typeof target === "string" ? qs(target) : (target || qs("[data-resources-table]"));
  if (!wrap) return;
  if (!state.resources.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-file-alt"></i><span>Aucune ressource enregistrée.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Titre</th><th>Type</th><th>Formation</th>${editable ? "<th>Action</th>" : ""}
      </tr></thead>
      <tbody>
        ${state.resources.map(r => `
          <tr>
            <td><strong>${r.title}</strong></td>
            <td><span class="badge badge-category">${r.type}</span></td>
            <td style="color:var(--muted)">${r.formation}</td>
            ${editable ? `<td>
              <div style="display:flex;gap:0.5rem">
                <button class="button-warning" data-edit-resource="${r.id}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="button-danger" data-delete-resource="${r.id}">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </td>` : ""}
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderRegistrationsTable() {
  const wrap = qs("[data-registrations-table]");
  if (!wrap) return;
  if (!state.registrations || !state.registrations.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard-check"></i><span>Aucun dossier en attente.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Étudiant</th><th>CIN</th><th>Formation</th><th>Statut</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${state.registrations.map(r => `
          <tr>
            <td><strong>${r.prenom} ${r.nom}</strong><br><small style="color:var(--muted)">${r.email}</small></td>
            <td style="color:var(--muted)">${r.cin}</td>
            <td>${r.classe}</td>
            <td><span class="badge ${r.status === 'Validé' ? 'badge-role-admin' : (r.status === 'Rejeté' ? 'badge-status-full' : 'badge-level')}">${r.status || 'En attente'}</span></td>
            <td>
              ${(!r.status || r.status === 'En attente') ? `
                <div style="display:flex;gap:0.5rem">
                  <button class="button" style="padding:0.4rem 0.8rem;font-size:0.85rem;" data-status-reg="${r.id}" data-status="Validé"><i class="fas fa-check"></i></button>
                  <button class="button-danger" style="padding:0.4rem 0.8rem;font-size:0.85rem;" data-status-reg="${r.id}" data-status="Rejeté"><i class="fas fa-times"></i></button>
                </div>
              ` : `<span style="color:var(--muted)">Traité</span>`}
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

// ─── LOAD BACKEND DATA ────────────────────────────────────────────────────────

async function loadBackendData() {
  const [fd, cd, ed, cod, rd] = await Promise.all([
    apiRequest("/api/formations"),
    apiRequest("/api/clubs"),
    apiRequest("/api/events"),
    apiRequest("/api/courses"),
    apiRequest("/api/resources")
  ]);
  state.formations = fd.formations;
  state.clubs = cd.clubs;
  state.events = ed.events;
  state.courses = cod.courses;
  state.resources = rd.resources;
}

function renderPageData() {
  renderFormationCards(qsa("[data-formations-grid]"));
  renderClubCards(qsa("[data-clubs-grid]"), 0);
  renderClubCards(qsa("[data-clubs-preview]"), 3);
  renderEventCards(qsa("[data-events-grid]"), 0);
  renderEventCards(qsa("[data-events-preview]"), 3);
  renderHomeMetrics();
  renderCourses();
  renderResources();
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

async function joinClub(id) {
  if (!state.user) { showToast("Connectez-vous pour rejoindre un club.", "danger"); return; }
  try {
    const data = await apiRequest(`/api/clubs/${id}/join`, { method: "POST" });
    showToast(data.message, "success");
    await loadUserActivity();
    renderUserDashboard();
  } catch (e) { showToast(e.message, "danger"); }
}

async function registerToEvent(id) {
  if (!state.user) { showToast("Connectez-vous pour vous inscrire à un événement.", "danger"); return; }
  try {
    const data = await apiRequest(`/api/events/${id}/register`, { method: "POST" });
    state.events = state.events.map(ev => ev.id === data.event.id ? data.event : ev);
    renderEventCards(qsa("[data-events-grid]"), 0);
    renderEventCards(qsa("[data-events-preview]"), 3);
    renderCalendar();
    showToast(data.message, "success");
    await loadUserActivity();
    renderUserDashboard();
  } catch (e) { showToast(e.message, "danger"); }
}

async function deleteFormation(id) {
  if (!confirm("Supprimer cette formation définitivement ?")) return;
  try {
    await apiRequest(`/api/admin/formations/${id}`, { method: "DELETE" });
    state.formations = state.formations.filter(f => f.id !== id);
    renderFormationsTable();
    renderFormationCards(qsa("[data-formations-grid]"));
    showToast("Formation supprimée.", "success");
    loadAdminData();
  } catch (e) { showToast(e.message, "danger"); }
}

async function deleteClub(id) {
  if (!confirm("Supprimer ce club définitivement ?")) return;
  try {
    await apiRequest(`/api/admin/clubs/${id}`, { method: "DELETE" });
    state.clubs = state.clubs.filter(c => c.id !== id);
    renderClubsTable();
    renderClubCards(qsa("[data-clubs-grid]"), 0);
    renderClubCards(qsa("[data-clubs-preview]"), 3);
    showToast("Club supprimé.", "success");
    loadAdminData();
  } catch (e) { showToast(e.message, "danger"); }
}

async function deleteEvent(id) {
  if (!confirm("Supprimer cet événement définitivement ?")) return;
  try {
    await apiRequest(`/api/admin/events/${id}`, { method: "DELETE" });
    state.events = state.events.filter(ev => ev.id !== id);
    renderEventsTable();
    renderEventCards(qsa("[data-events-grid]"), 0);
    renderEventCards(qsa("[data-events-preview]"), 3);
    renderCalendar();
    showToast("Événement supprimé.", "success");
    loadAdminData();
  } catch (e) { showToast(e.message, "danger"); }
}

async function deleteCourse(id) {
  if (!confirm("Supprimer ce cours définitivement ?")) return;
  try {
    await apiRequest(`/api/admin/courses/${id}`, { method: "DELETE" });
    state.courses = state.courses.filter(c => c.id !== id);
    renderCoursesTable();
    renderCourses();
    showToast("Cours supprimé.", "success");
    loadAdminData();
  } catch (e) { showToast(e.message, "danger"); }
}

async function deleteResource(id) {
  if (!confirm("Supprimer cette ressource définitivement ?")) return;
  try {
    await apiRequest(`/api/admin/resources/${id}`, { method: "DELETE" });
    state.resources = state.resources.filter(r => r.id !== id);
    renderResourcesTable();
    renderResources();
    showToast("Ressource supprimée.", "success");
    loadAdminData();
  } catch (e) { showToast(e.message, "danger"); }
}

async function updateRegistrationStatus(id, status) {
  try {
    await apiRequest(`/api/admin/registrations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    const reg = state.registrations.find(r => r.id === id);
    if (reg) reg.status = status;
    renderRegistrationsTable();
    showToast(`Dossier ${status.toLowerCase()}.`, "success");
  } catch (e) { showToast(e.message, "danger"); }
}

async function updateOwnerRequestStatus(id, status) {
  try {
    const data = await apiRequest(`/api/club-owner/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    showToast(data.message, "success");
    await loadOwnerRequests();
  } catch (e) {
    showToast(e.message, "danger");
  }
}

// ─── EDIT MODAL LOGIC ─────────────────────────────────────────────────────────

let currentEdit = { type: null, id: null };

function openEditModal(type, id) {
  const modal = qs("#edit-modal");
  const title = qs("#modal-title");
  const fields = qs("#modal-fields");
  if (!modal || !fields) return;

  currentEdit = { type, id };
  fields.innerHTML = "";
  modal.classList.add("is-open");

  if (type === "formation") {
    const item = state.formations.find(f => f.id === id);
    title.textContent = "Modifier la formation";
    fields.innerHTML = `
      <div class="form-field"><label>Nom</label><input type="text" name="name" value="${item.name}" required></div>
      <div class="form-field"><label>Niveau</label><input type="text" name="level" value="${item.level}" required></div>
      <div class="form-field"><label>Description</label><textarea name="description" required>${item.description}</textarea></div>
    `;
  } else if (type === "club") {
    const item = state.clubs.find(c => c.id === id);
    title.textContent = "Modifier le club";
    fields.innerHTML = `
      <div class="form-field"><label>Nom</label><input type="text" name="name" value="${item.name}" required></div>
      <div class="form-field"><label>Catégorie</label><input type="text" name="category" value="${item.category}" required></div>
      <div class="form-field"><label>Image URL</label><input type="text" name="img" value="${item.img || ""}"></div>
      <div class="form-field"><label>Description</label><textarea name="desc" required>${item.description || item.desc}</textarea></div>
    `;
  } else if (type === "event") {
    const item = state.events.find(e => e.id === id);
    title.textContent = "Modifier l'événement";
    fields.innerHTML = `
      <div class="form-field"><label>Titre</label><input type="text" name="title" value="${item.title}" required></div>
      <div class="form-field"><label>Date</label><input type="date" name="date" value="${item.eventDate || item.date}" required></div>
      <div class="form-field"><label>Lieu</label><input type="text" name="location" value="${item.location}" required></div>
      <div class="form-field"><label>Organisateur</label><input type="text" name="organizer" value="${item.organizer}" required></div>
      <div class="form-field"><label>Capacité</label><input type="number" name="capacity" value="${item.capacity}" required></div>
      <div class="form-field"><label>Description</label><textarea name="desc" required>${item.description || item.desc}</textarea></div>
    `;
  } else if (type === "course") {
    const item = state.courses.find(c => c.id === id);
    title.textContent = "Modifier le cours";
    fields.innerHTML = `
      <div class="form-field"><label>Titre</label><input type="text" name="title" value="${item.title}" required></div>
      <div class="form-field"><label>Formation</label><input type="text" name="formation" value="${item.formation}" required></div>
      <div class="form-field"><label>Enseignant</label><input type="text" name="teacher" value="${item.teacher}" required></div>
      <div class="form-field"><label>Lien Drive</label><input type="url" name="link" value="${item.link || ""}"></div>
      <div class="form-field"><label>Description</label><textarea name="description" required>${item.description}</textarea></div>
    `;
  } else if (type === "resource") {
    const item = state.resources.find(r => r.id === id);
    title.textContent = "Modifier la ressource";
    fields.innerHTML = `
      <div class="form-field"><label>Titre</label><input type="text" name="title" value="${item.title}" required></div>
      <div class="form-field"><label>Type</label><input type="text" name="type" value="${item.type}" required></div>
      <div class="form-field"><label>Formation</label><input type="text" name="formation" value="${item.formation}" required></div>
      <div class="form-field"><label>Lien Drive</label><input type="url" name="link" value="${item.link || ""}"></div>
      <div class="form-field"><label>Description</label><textarea name="description" required>${item.description}</textarea></div>
    `;
  } else if (type === "user") {
    const item = state.allUsers.find(u => u.id === id);
    title.textContent = "Modifier le compte";
    fields.innerHTML = `
      <div class="form-field"><label>Nom complet</label><input type="text" name="fullName" value="${item.fullName}" required></div>
      <div class="form-field"><label>Email</label><input type="email" name="email" value="${item.email}" required></div>
      <div class="form-field"><label>Type de compte</label>
        <select name="role" required>
          <option value="student" ${item.role === "student" ? "selected" : ""}>Etudiant</option>
          <option value="club_owner" ${item.role === "club_owner" ? "selected" : ""}>Responsable de club</option>
          <option value="teacher" ${item.role === "teacher" ? "selected" : ""}>Enseignant</option>
          <option value="admin" ${item.role === "admin" ? "selected" : ""}>Administrateur</option>
        </select>
      </div>
      <div class="form-field"><label>Club associe</label>
        <select name="clubId" data-user-club-select>
          <option value="">Aucun club</option>
        </select>
      </div>
      <div class="form-field"><label>Photo de profil</label><input type="file" name="profilePicture" accept="image/*"></div>
      <div class="form-field"><label>Mot de passe temporaire</label><input type="text" name="password" placeholder="Laisser vide pour conserver"></div>
    `;
    populateClubSelects();
    const clubField = fields.querySelector('select[name="clubId"]');
    if (clubField && item.ownedClubId) clubField.value = String(item.ownedClubId);
  }
}

function closeEditModal() {
  qs("#edit-modal")?.classList.remove("is-open");
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { type, id } = currentEdit;

  let body;
  if (type === "user") {
    body = fd;
  } else {
    body = JSON.stringify(Object.fromEntries(fd.entries()));
  }

  try {
    const res = await apiRequest(`/api/admin/${type}s/${id}`, {
      method: "PATCH",
      body: body
    });

    showToast(res.message, "success");
    closeEditModal();

    // Refresh data
    await loadBackendData();
    renderPageData();
    if (state.user?.role === "admin") renderAdminTables();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

function setupDelegatedActions() {
  qs("#edit-form")?.addEventListener("submit", handleEditSubmit);
  qs("[data-close-modal]")?.addEventListener("click", closeEditModal);

  document.addEventListener("click", async e => {
    const joinBtn = e.target.closest("[data-club-join]");
    if (joinBtn) { await joinClub(Number(joinBtn.dataset.clubJoin)); return; }

    const regBtn = e.target.closest("[data-event-register]");
    if (regBtn && !regBtn.disabled) { await registerToEvent(Number(regBtn.dataset.eventRegister)); return; }

    // Edits
    const editForm = e.target.closest("[data-edit-formation]");
    if (editForm) { openEditModal("formation", Number(editForm.dataset.editFormation)); return; }

    const editClub = e.target.closest("[data-edit-club]");
    if (editClub) { openEditModal("club", Number(editClub.dataset.editClub)); return; }

    const editEvent = e.target.closest("[data-edit-event]");
    if (editEvent) { openEditModal("event", Number(editEvent.dataset.editEvent)); return; }

    const editCourse = e.target.closest("[data-edit-course]");
    if (editCourse) { openEditModal("course", Number(editCourse.dataset.editCourse)); return; }

    const editRes = e.target.closest("[data-edit-resource]");
    if (editRes) { openEditModal("resource", Number(editRes.dataset.editResource)); return; }

    const editUser = e.target.closest("[data-edit-user]");
    if (editUser) { openEditModal("user", Number(editUser.dataset.editUser)); return; }

    // Deletes
    const delForm = e.target.closest("[data-delete-formation]");
    if (delForm) { await deleteFormation(Number(delForm.dataset.deleteFormation)); return; }

    const delClub = e.target.closest("[data-delete-club]");
    if (delClub) { await deleteClub(Number(delClub.dataset.deleteClub)); return; }

    const delEvent = e.target.closest("[data-delete-event]");
    if (delEvent) { await deleteEvent(Number(delEvent.dataset.deleteEvent)); return; }

    const delCourse = e.target.closest("[data-delete-course]");
    if (delCourse) { await deleteCourse(Number(delCourse.dataset.deleteCourse)); return; }

    const delRes = e.target.closest("[data-delete-resource]");
    if (delRes) { await deleteResource(Number(delRes.dataset.deleteResource)); return; }

    const statusReg = e.target.closest("[data-status-reg]");
    if (statusReg) { await updateRegistrationStatus(Number(statusReg.dataset.statusReg), statusReg.dataset.status); return; }

    const ownerAction = e.target.closest("[data-owner-request-action]");
    if (ownerAction) {
      await updateOwnerRequestStatus(Number(ownerAction.dataset.ownerRequestAction), ownerAction.dataset.ownerStatus);
      return;
    }

    const logoutBtn = e.target.closest("[data-logout]");
    if (logoutBtn) {
      clearSession();
      updatePortalState();
      showToast("Vous êtes déconnecté.");
    }
  });
}

// ─── PORTAL FORMS ─────────────────────────────────────────────────────────────

function setupPortalForms() {
  const loginForm = qs("[data-login-form]");
  const studentForm = qs("[data-student-form]");
  const adminForm = qs("[data-admin-form]");
  const clubAdminForm = qs("[data-club-admin-form]");
  const eventAdminForm = qs("[data-event-admin-form]");
  const courseAdminForm = qs("[data-course-admin-form]");
  const resourceAdminForm = qs("[data-resource-admin-form]");
  const userAdminForm = qs("[data-user-admin-form]");
  const teacherCourseForm = qs("[data-teacher-course-form]");
  const teacherResourceForm = qs("[data-teacher-resource-form]");

  loginForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") })
      });
      setSession(data.token, data.user);
      loginForm.reset();
      await loadUserActivity();
      updatePortalState();
      showToast(`Bienvenue, ${data.user.fullName} !`, "success");
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  studentForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(studentForm);
    try {
      await apiRequest("/api/registrations", {
        method: "POST",
        body: JSON.stringify({
          nom: fd.get("nom"),
          prenom: fd.get("prenom"),
          cin: fd.get("cin"),
          classe: fd.get("classe"),
          email: fd.get("email"),
          userId: state.user ? state.user.id : null
        })
      });
      studentForm.reset();
      showToast("Dossier d'inscription envoye avec succes.", "success");
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  adminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(adminForm);
    try {
      const data = await apiRequest("/api/formations", {
        method: "POST",
        body: JSON.stringify({ name: fd.get("name"), level: fd.get("level"), description: fd.get("description") })
      });
      state.formations.push(data.formation);
      adminForm.reset();
      renderFormationsTable();
      renderFormationCards(qsa("[data-formations-grid]"));
      showToast("Formation ajoutee.", "success");
      loadAdminData();
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  clubAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(clubAdminForm);
    try {
      const data = await apiRequest("/api/admin/clubs", {
        method: "POST",
        body: JSON.stringify({ name: fd.get("name"), category: fd.get("category"), desc: fd.get("desc"), img: fd.get("img") })
      });
      state.clubs.push(data.club);
      clubAdminForm.reset();
      renderClubsTable();
      renderClubCards(qsa("[data-clubs-grid]"), 0);
      renderClubCards(qsa("[data-clubs-preview]"), 3);
      populateClubSelects();
      showToast("Club cree.", "success");
      loadAdminData();
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  eventAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(eventAdminForm);
    try {
      const data = await apiRequest("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), date: fd.get("date"), location: fd.get("location"), organizer: fd.get("organizer"), desc: fd.get("desc"), capacity: fd.get("capacity") })
      });
      state.events.push(data.event);
      eventAdminForm.reset();
      renderEventsTable();
      renderEventCards(qsa("[data-events-grid]"), 0);
      renderEventCards(qsa("[data-events-preview]"), 3);
      renderCalendar();
      showToast("Evenement planifie.", "success");
      loadAdminData();
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  courseAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(courseAdminForm);
    try {
      const data = await apiRequest("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), formation: fd.get("formation"), teacher: fd.get("teacher"), description: fd.get("description"), link: fd.get("link") })
      });
      state.courses.push(data.course);
      courseAdminForm.reset();
      renderCoursesTable("[data-courses-table]", true);
      renderCourses();
      showToast("Cours ajoute.", "success");
      loadAdminData();
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  resourceAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(resourceAdminForm);
    try {
      const data = await apiRequest("/api/admin/resources", {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), type: fd.get("type"), formation: fd.get("formation"), description: fd.get("description"), link: fd.get("link") })
      });
      state.resources.push(data.resource);
      resourceAdminForm.reset();
      renderResourcesTable("[data-resources-table]", true);
      renderResources();
      showToast("Ressource ajoutee.", "success");
      loadAdminData();
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  userAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(userAdminForm);
    try {
      const data = await apiRequest("/api/admin/users", {
        method: "POST",
        body: fd
      });
      state.allUsers.unshift(data.user);
      userAdminForm.reset();
      state.userSearch = "";
      const searchInput = qs("[data-user-search]");
      if (searchInput) searchInput.value = "";
      renderUsersTable();
      populateClubSelects();
      showToast("Compte cree.", "success");
      loadAdminData();
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  teacherCourseForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(teacherCourseForm);
    try {
      const data = await apiRequest("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), formation: fd.get("formation"), teacher: state.user?.fullName || "", description: fd.get("description"), link: fd.get("link") })
      });
      state.courses.push(data.course);
      teacherCourseForm.reset();
      renderCoursesTable("[data-teacher-courses-table]", false);
      renderCourses();
      showToast("Cours publie.", "success");
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  teacherResourceForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(teacherResourceForm);
    try {
      const data = await apiRequest("/api/admin/resources", {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), type: fd.get("type"), formation: fd.get("formation"), description: fd.get("description"), link: fd.get("link") })
      });
      state.resources.push(data.resource);
      teacherResourceForm.reset();
      renderResourcesTable("[data-teacher-resources-table]", false);
      renderResources();
      showToast("Ressource publiee.", "success");
    } catch (e) {
      showToast(e.message, "danger");
    }
  });

  qs("[data-user-search]")?.addEventListener("input", e => {
    state.userSearch = e.target.value || "";
    renderUsersTable();
  });
}
// ─── COURSE FILTERS ───────────────────────────────────────────────────────────

function setupCourseFilters() {
  qs("[data-course-search]")?.addEventListener("input", renderCourses);
  qs("[data-course-filter]")?.addEventListener("change", renderCourses);
  qs("[data-course-reset]")?.addEventListener("click", () => {
    const s = qs("[data-course-search]");
    const f = qs("[data-course-filter]");
    if (s) s.value = "";
    if (f) f.value = "all";
    renderCourses();
  });
}

// ─── INIT & ANIMATIONS ────────────────────────────────────────────────────────

function injectGlobalUI() {
  const navActions = document.querySelector('.nav-actions');
  if (navActions && !document.querySelector('.theme-toggle')) {
    const html = `
      <button class="action-icon-btn theme-toggle" type="button" aria-label="Basculer le thème" data-theme-toggle>
        <i class="fas fa-moon"></i>
      </button>
    `;
    navActions.insertAdjacentHTML('afterbegin', html);
  }
}

function renderSkeletons() {
  const formationHtml = '<article class="skeleton-card"><div class="skeleton skeleton-text short"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></article>'.repeat(3);
  qsa("[data-formations-grid]").forEach(t => t.innerHTML = formationHtml);
  
  const clubHtml = '<article class="skeleton-card"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-text short"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></article>'.repeat(3);
  qsa("[data-clubs-grid], [data-clubs-preview]").forEach(t => t.innerHTML = clubHtml);
  
  const eventHtml = '<article class="skeleton-card"><div class="skeleton skeleton-text short"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></article>'.repeat(3);
  qsa("[data-events-grid], [data-events-preview]").forEach(t => t.innerHTML = eventHtml);
}

function setupScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        
        if (entry.target.hasAttribute("data-stat-counter") && !entry.target.dataset.animated) {
          entry.target.dataset.animated = "true";
          const targetNum = parseInt(entry.target.getAttribute("data-stat-counter"), 10);
          if (!isNaN(targetNum)) {
            animateCounter(entry.target, targetNum, 2000);
          }
        }
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  qsa("[data-animate], [data-stat-counter]").forEach((el, i) => {
    // Add staggered delay based on index for grid items
    if (el.parentElement.classList.contains('grid-3') || el.parentElement.classList.contains('grid-2')) {
      el.style.transitionDelay = `${(i % 3) * 0.1}s`;
    }
    observer.observe(el);
  });
}

function setupMagneticButtons() {
  const buttons = qsa('.button, .button-secondary, .brand');
  buttons.forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

function setupCardTilt() {
  const cards = qsa('.content-card, .spotlight-card, .panel-art');
  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

function setupReadingProgress() {
  const bar = document.createElement('div');
  bar.className = 'reading-progress-bar';
  document.body.appendChild(bar);
  
  window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    bar.style.width = scrolled + "%";
  });
}

function setupCustomCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  const ring = document.createElement('div');
  ring.className = 'custom-cursor-ring';
  document.body.appendChild(cursor);
  document.body.appendChild(ring);

  window.addEventListener('mousemove', e => {
    cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    ring.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  });

  const interactives = qsa('a, button, .content-card, .spotlight-card, input, select, textarea');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.classList.add('is-hovering');
      ring.classList.add('is-hovering');
    });
    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('is-hovering');
      ring.classList.remove('is-hovering');
    });
  });
}

function setupHeroParallax() {
  const hero = qs('.page-hero');
  if (!hero) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroPanel = hero.querySelector('.hero-panel');
    const heroStack = hero.querySelector('.hero-stack');
    if (heroPanel) heroPanel.style.transform = `translateY(${scrolled * 0.1}px)`;
    if (heroStack) heroStack.style.transform = `translateY(${scrolled * 0.15}px)`;
  });
}

function setupPageTransitions() {
  const overlay = document.createElement('div');
  overlay.className = 'page-transition-overlay';
  document.body.appendChild(overlay);
  
  // Use setTimeout to ensure transition works
  setTimeout(() => {
    overlay.classList.add('is-loaded');
  }, 100);

  qsa('a').forEach(link => {
    if (link.hostname === window.location.hostname && !link.hash && link.target !== '_blank') {
      link.addEventListener('click', e => {
        e.preventDefault();
        overlay.classList.remove('is-loaded');
        setTimeout(() => {
          window.location.href = link.href;
        }, 350);
      });
    }
  });
}

function animateCounter(el, target, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeProgress = progress * (2 - progress);
    const currentNum = Math.floor(easeProgress * target);
    el.textContent = formatCount(currentNum) + (el.dataset.suffix || "");
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.textContent = formatCount(target) + (el.dataset.suffix || "");
    }
  };
  window.requestAnimationFrame(step);
}

async function initialize() {
  injectGlobalUI();
  setupGlobalEvents();
  initTheme();
  
  setupNavigation();
  setupTabs();
  setupCourseFilters();
  setupDelegatedActions();
  setupPortalForms();
  try {
    renderSkeletons();
    
    // Reduce artificial delay to make UI snappier, keeping skeleton layout smooth
    await new Promise(r => setTimeout(r, 200));

    await loadBackendData();
    await hydrateSession();
    renderPageData();
    renderCalendar();
  } catch (e) {
    console.error("Erreur de chargement:", e);
    showToast("Impossible de contacter le serveur.", "danger");
  } finally {
    setupScrollAnimations();
    setupMagneticButtons();
    setupCardTilt();
    setupReadingProgress();
    setupHeroParallax();
    setupPageTransitions();
  }
}

document.addEventListener("DOMContentLoaded", initialize);
