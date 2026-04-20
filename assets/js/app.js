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
}

async function apiRequest(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
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
  const sectionAdmin = qs("[data-section-admin]");

  if (!sectionGuest) return;

  if (!state.user) {
    sectionGuest.hidden = false;
    if (sectionStudent) sectionStudent.hidden = true;
    if (sectionAdmin) sectionAdmin.hidden = true;
    return;
  }

  sectionGuest.hidden = true;

  if (state.user.role === "admin") {
    if (sectionStudent) sectionStudent.hidden = true;
    if (sectionAdmin) {
      sectionAdmin.hidden = false;
      loadAdminData();
    }
  } else {
    if (sectionStudent) {
      sectionStudent.hidden = false;
      const welcome = qs("#student-welcome");
      if (welcome) welcome.textContent = `Bonjour, ${state.user.fullName} !`;
      renderUserDashboard();
    }
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

function renderUserDashboard() {
  const dashboard = qs("[data-user-dashboard]");
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
      ${club.img ? `<img src="${club.img}" alt="${club.name}" style="border-radius:18px;height:200px;width:100%;object-fit:cover;margin-bottom:1rem">` : ""}
      <span class="card-label">${club.category}</span>
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
      <span class="resource-tag">${c.formation}</span>
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
      <span class="resource-tag">${r.type}</span>
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
  renderCoursesTable();
  renderResourcesTable();
  renderClubsTable();
  renderEventsTable();
  renderRegistrationsTable();
  renderUsersTable();
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
            <td><button class="button-danger" data-delete-formation="${f.id}">
              <i class="fas fa-trash-alt"></i> Supprimer
            </button></td>
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
            <td><button class="button-danger" data-delete-club="${c.id}">
              <i class="fas fa-trash-alt"></i> Supprimer
            </button></td>
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
            <td><button class="button-danger" data-delete-event="${ev.id}">
              <i class="fas fa-trash-alt"></i> Supprimer
            </button></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

function renderUsersTable() {
  const wrap = qs("[data-users-table]");
  if (!wrap) return;
  if (!state.allUsers.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-user-cog"></i><span>Aucun utilisateur enregistré.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Nom complet</th><th>Email</th><th>Rôle</th><th>Date d'inscription</th>
      </tr></thead>
      <tbody>
        ${state.allUsers.map(u => `
          <tr>
            <td><strong>${u.fullName}</strong></td>
            <td style="color:var(--muted)">${u.email}</td>
            <td><span class="badge ${u.role === "admin" ? "badge-role-admin" : "badge-role-student"}">
              ${u.role === "admin" ? "Administrateur" : "Étudiant"}
            </span></td>
            <td style="color:var(--muted);font-size:.9rem">${formatDate(u.createdAt)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderCoursesTable() {
  const wrap = qs("[data-courses-table]");
  if (!wrap) return;
  if (!state.courses.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-book"></i><span>Aucun cours enregistré.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Titre</th><th>Formation</th><th>Enseignant</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${state.courses.map(c => `
          <tr>
            <td><strong>${c.title}</strong></td>
            <td><span class="badge badge-level">${c.formation}</span></td>
            <td style="color:var(--muted)">${c.teacher}</td>
            <td><button class="button-danger" data-delete-course="${c.id}">
              <i class="fas fa-trash-alt"></i> Supprimer
            </button></td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderResourcesTable() {
  const wrap = qs("[data-resources-table]");
  if (!wrap) return;
  if (!state.resources.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-file-alt"></i><span>Aucune ressource enregistrée.</span></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Titre</th><th>Type</th><th>Formation</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${state.resources.map(r => `
          <tr>
            <td><strong>${r.title}</strong></td>
            <td><span class="badge badge-category">${r.type}</span></td>
            <td style="color:var(--muted)">${r.formation}</td>
            <td><button class="button-danger" data-delete-resource="${r.id}">
              <i class="fas fa-trash-alt"></i> Supprimer
            </button></td>
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

function setupDelegatedActions() {
  document.addEventListener("click", async e => {
    const joinBtn = e.target.closest("[data-club-join]");
    if (joinBtn) { await joinClub(Number(joinBtn.dataset.clubJoin)); return; }

    const regBtn = e.target.closest("[data-event-register]");
    if (regBtn && !regBtn.disabled) { await registerToEvent(Number(regBtn.dataset.eventRegister)); return; }

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
  const registerForm = qs("[data-register-form]");
  const studentForm = qs("[data-student-form]");
  const adminForm = qs("[data-admin-form]");
  const clubAdminForm = qs("[data-club-admin-form]");
  const eventAdminForm = qs("[data-event-admin-form]");
  const courseAdminForm = qs("[data-course-admin-form]");
  const resourceAdminForm = qs("[data-resource-admin-form]");

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
    } catch (e) { showToast(e.message, "danger"); }
  });

  registerForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(registerForm);
    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName: fd.get("fullName"), email: fd.get("email"), password: fd.get("password") })
      });
      setSession(data.token, data.user);
      registerForm.reset();
      updatePortalState();
      showToast("Compte créé avec succès !", "success");
    } catch (e) { showToast(e.message, "danger"); }
  });

  studentForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(studentForm);
    try {
      await apiRequest("/api/registrations", {
        method: "POST",
        body: JSON.stringify({
          nom: fd.get("nom"), prenom: fd.get("prenom"),
          cin: fd.get("cin"), classe: fd.get("classe"),
          email: fd.get("email"), userId: state.user ? state.user.id : null
        })
      });
      studentForm.reset();
      showToast("Dossier d'inscription envoyé avec succès.", "success");
    } catch (e) { showToast(e.message, "danger"); }
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
      showToast("Formation ajoutée.", "success");
      loadAdminData();
    } catch (e) { showToast(e.message, "danger"); }
  });

  clubAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(clubAdminForm);
    try {
      const data = await apiRequest("/api/admin/clubs", {
        method: "POST",
        body: JSON.stringify({ name: fd.get("name"), category: fd.get("category"), desc: fd.get("desc") })
      });
      state.clubs.push(data.club);
      clubAdminForm.reset();
      renderClubsTable();
      renderClubCards(qsa("[data-clubs-grid]"), 0);
      renderClubCards(qsa("[data-clubs-preview]"), 3);
      showToast("Club créé.", "success");
      loadAdminData();
    } catch (e) { showToast(e.message, "danger"); }
  });

  eventAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(eventAdminForm);
    try {
      const data = await apiRequest("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"), date: fd.get("date"),
          location: fd.get("location"), organizer: fd.get("organizer"),
          desc: fd.get("desc"), capacity: fd.get("capacity")
        })
      });
      state.events.push(data.event);
      eventAdminForm.reset();
      renderEventsTable();
      renderEventCards(qsa("[data-events-grid]"), 0);
      renderEventCards(qsa("[data-events-preview]"), 3);
      renderCalendar();
      showToast("Événement planifié.", "success");
      loadAdminData();
    } catch (e) { showToast(e.message, "danger"); }
  });

  courseAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(courseAdminForm);
    try {
      const data = await apiRequest("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), formation: fd.get("formation"), teacher: fd.get("teacher"), description: fd.get("description") })
      });
      state.courses.push(data.course);
      courseAdminForm.reset();
      renderCoursesTable();
      renderCourses();
      showToast("Cours ajouté.", "success");
      loadAdminData();
    } catch (e) { showToast(e.message, "danger"); }
  });

  resourceAdminForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(resourceAdminForm);
    try {
      const data = await apiRequest("/api/admin/resources", {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), type: fd.get("type"), formation: fd.get("formation"), description: fd.get("description") })
      });
      state.resources.push(data.resource);
      resourceAdminForm.reset();
      renderResourcesTable();
      renderResources();
      showToast("Ressource ajoutée.", "success");
      loadAdminData();
    } catch (e) { showToast(e.message, "danger"); }
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
  await hydrateSession();
  try {
    renderSkeletons();
    
    // Reduce artificial delay to make UI snappier, keeping skeleton layout smooth
    await new Promise(r => setTimeout(r, 200));

    await loadBackendData();
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
    setupCustomCursor();
    setupHeroParallax();
    setupPageTransitions();
  }
}

document.addEventListener("DOMContentLoaded", initialize);
