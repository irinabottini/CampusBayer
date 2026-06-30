const ROLE_SECTIONS = {
  Administrador: [
    "inicio",
    "organizar",
    "eventos",
    "confirmar",
    "calendario",
    "experiencia",
    "feedback",
    "assessments",
    "metricas",
    "instalar"
  ],
  Equipo: ["inicio", "eventos", "calendario", "feedback", "assessments"],
  Organizador: ["inicio", "organizar", "eventos", "calendario", "metricas"],
  Ventas: ["inicio", "organizar", "eventos", "confirmar", "calendario", "experiencia"],
  Invitados: ["inicio", "confirmar", "experiencia"]
};

const SECTIONS = {
  inicio: { title: "Inicio", icon: "home" },
  organizar: { title: "Quiero organizar mi evento", icon: "calendar-plus" },
  eventos: { title: "Eventos creados", icon: "list-check" },
  confirmar: { title: "Confirmar invitación", icon: "check-circle" },
  calendario: { title: "Calendario", icon: "calendar-days" },
  experiencia: { title: "Compartí tu experiencia", icon: "message-square" },
  feedback: { title: "Feedback", icon: "send" },
  assessments: { title: "Assessments", icon: "clipboard-check" },
  metricas: { title: "Métricas", icon: "bar-chart" },
  instalar: { title: "Instalar", icon: "download" }
};

const STORAGE_KEY = "campusBayerEventos";
const CARLA_EMAIL = "carla.serre@bayer.com";

const fallbackUsers = [
  {
    CWID: "GMERQ",
    Nombre: "Irina",
    Apellido: "Botini",
    mail: "irinabottini@bayer.com",
    rol: "Administrador",
    funcion: "Data Analyst",
    squad: "CP",
    ceco: "",
    cuenta_mayor: ""
  }
];

let users = [];
let currentUser = null;
let currentSection = "inicio";
let events = [];

const loginView = document.querySelector("#loginView");
const contentView = document.querySelector("#contentView");
const loginForm = document.querySelector("#loginForm");
const cwidInput = document.querySelector("#cwidInput");
const formMessage = document.querySelector("#formMessage");
const navList = document.querySelector("#navList");
const userPill = document.querySelector("#userPill");
const roleLabel = document.querySelector("#roleLabel");
const sectionTitle = document.querySelector("#sectionTitle");
const sectionContent = document.querySelector("#sectionContent");
const logoutButton = document.querySelector("#logoutButton");
const menuButton = document.querySelector("#menuButton");
const sidebar = document.querySelector(".sidebar");

async function loadUsers() {
  try {
    const response = await fetch("data/base_usuarios.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar la base de usuarios");
    users = await response.json();
  } catch (error) {
    users = fallbackUsers;
  }
}

function loadEvents() {
  try {
    events = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    events = [];
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function normalizeCwid(value) {
  return value.trim().toUpperCase();
}

function findUser(cwid) {
  return users.find((user) => normalizeCwid(user.CWID) === cwid);
}

function login(user) {
  currentUser = user;
  currentSection = getInitialSection();
  loginView.hidden = true;
  contentView.hidden = false;
  logoutButton.hidden = false;
  renderShell();
  renderSection(currentSection);
}

function logout() {
  currentUser = null;
  loginView.hidden = false;
  contentView.hidden = true;
  logoutButton.hidden = true;
  navList.innerHTML = "";
  userPill.hidden = true;
  cwidInput.value = "";
  cwidInput.focus();
}

function getInitialSection() {
  const params = new URLSearchParams(window.location.search);
  return params.get("section") === "confirmar" ? "confirmar" : "inicio";
}

function canViewEvent(event) {
  return currentUser?.rol === "Administrador" || event.creatorCwid === currentUser?.CWID;
}

function getVisibleEvents() {
  return events.filter(canViewEvent).sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`));
}

function renderShell() {
  const allowedSections = ROLE_SECTIONS[currentUser.rol] || ROLE_SECTIONS.Invitados;

  userPill.hidden = false;
  userPill.innerHTML = `
    <strong>${currentUser.Nombre} ${currentUser.Apellido}</strong>
    <span>${currentUser.rol} - ${currentUser.funcion}</span>
  `;

  navList.innerHTML = allowedSections
    .map((sectionId) => {
      const section = SECTIONS[sectionId];
      return `
        <button class="nav-button ${sectionId === currentSection ? "active" : ""}" type="button" data-section="${sectionId}">
          <span class="nav-icon" aria-hidden="true">${getIcon(section.icon)}</span>
          <span>${section.title}</span>
        </button>
      `;
    })
    .join("");
}

function renderSection(sectionId) {
  currentSection = sectionId;
  const section = SECTIONS[sectionId];
  roleLabel.textContent = `${currentUser.rol} - ${currentUser.CWID}`;
  sectionTitle.textContent = section.title;
  sectionContent.innerHTML = getSectionTemplate(sectionId);
  renderShell();
}

function getSectionTemplate(sectionId) {
  if (sectionId === "inicio") return getInicioTemplate();
  if (sectionId === "organizar") return getOrganizarTemplate();
  if (sectionId === "eventos") return getEventosTemplate();
  if (sectionId === "confirmar") return getConfirmarTemplate();
  if (sectionId === "calendario") return getCalendarioTemplate();
  if (sectionId === "metricas") return getMetricasTemplate();
  if (sectionId === "assessments") return getUsuariosTemplate();
  if (sectionId === "instalar") return getInstalarTemplate();

  return `
    <div class="placeholder-panel">
      <h2>${SECTIONS[sectionId].title}</h2>
      <p>Sección creada para completar en el próximo paso. La visibilidad ya queda conectada al rol del usuario logueado.</p>
    </div>
  `;
}

function getInicioTemplate() {
  return '<img class="hero-image" src="CampusBayer_Presentación.jpeg" alt="Presentación Campus Bayer" />';
}

function getOrganizarTemplate() {
  return `
    <form class="event-form" id="eventForm">
      <div class="form-grid">
        <label>
          Fecha de inicio
          <input name="startDate" type="date" required />
        </label>
        <label>
          Horario de inicio
          <input name="startTime" type="time" required />
        </label>
        <label>
          Fecha de fin
          <input name="endDate" type="date" required />
        </label>
        <label>
          Horario de fin
          <input name="endTime" type="time" required />
        </label>
        <label>
          Eje temático
          <select name="topic" required>
            <option value="">Seleccionar</option>
            <option value="Tema 1">Tema 1</option>
            <option value="Tema 2">Tema 2</option>
          </select>
        </label>
        <label>
          Asunto
          <input name="subject" type="text" placeholder="Asunto del evento" required />
        </label>
      </div>

      <div class="option-grid">
        ${getBooleanField("coffee", "Necesito coffee")}
        ${getBooleanField("speakers", "Necesito oradores")}
        ${getBooleanField("feedback", "Solicito feedback")}
      </div>

      <fieldset class="feedback-options" id="feedbackOptions" hidden>
        <legend>Tipo de feedback</legend>
        <label><input name="feedbackType" type="radio" value="Default" checked /> Default</label>
        <label><input name="feedbackType" type="radio" value="Personalizado" /> Personalizado</label>
      </fieldset>

      <label class="full-field">
        Mails de invitados
        <textarea name="guestEmails" rows="5" placeholder="Pegá los mails separados por coma, punto y coma o salto de línea" required></textarea>
      </label>

      <div class="form-actions">
        <button class="primary-button" type="submit">Crear evento</button>
      </div>
    </form>

    <div class="mail-panel" id="mailPanel" hidden></div>
  `;
}

function getBooleanField(name, label) {
  return `
    <fieldset class="toggle-group">
      <legend>${label}</legend>
      <label><input name="${name}" type="radio" value="Sí" /> Sí</label>
      <label><input name="${name}" type="radio" value="No" checked /> No</label>
    </fieldset>
  `;
}

function getEventosTemplate() {
  const visibleEvents = getVisibleEvents();
  if (!visibleEvents.length) {
    return `
      <div class="placeholder-panel">
        <h2>No hay eventos creados todavía</h2>
        <p>Cuando crees un evento, va a aparecer acá con sus invitados y confirmaciones.</p>
      </div>
    `;
  }

  return `<div class="event-list">${visibleEvents.map(getEventCard).join("")}</div>`;
}

function getCalendarioTemplate() {
  const visibleEvents = getVisibleEvents();
  if (!visibleEvents.length) {
    return `
      <div class="placeholder-panel">
        <h2>Calendario sin eventos</h2>
        <p>Los eventos creados se registran automáticamente en esta sección.</p>
      </div>
    `;
  }

  return `
    <div class="calendar-list">
      ${visibleEvents
        .map(
          (event) => `
            <article class="calendar-item">
              <div class="date-box">
                <strong>${formatDay(event.startDate)}</strong>
                <span>${formatMonth(event.startDate)}</span>
              </div>
              <div>
                <h2>${escapeHtml(event.subject)}</h2>
                <p>${formatDateTime(event.startDate, event.startTime)} a ${formatDateTime(event.endDate, event.endTime)}</p>
                <span class="status-pill">${event.confirmations.length}/${event.guestEmails.length} confirmados</span>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function getConfirmarTemplate() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event") || "";
  return `
    <form class="event-form compact-form" id="confirmForm">
      <label>
        Código de evento
        <input name="eventId" type="text" value="${escapeHtml(eventId)}" placeholder="Ej: CB-123456" required />
      </label>
      <label>
        Mail
        <input name="email" type="email" placeholder="tu.mail@bayer.com" required />
      </label>
      <label>
        Nombre y apellido
        <input name="name" type="text" placeholder="Nombre de quien confirma" required />
      </label>
      <label>
        Asistencia
        <select name="status" required>
          <option value="Confirmado">Confirmo asistencia</option>
          <option value="No asiste">No puedo asistir</option>
        </select>
      </label>
      <div class="form-actions">
        <button class="primary-button" type="submit">Guardar confirmación</button>
      </div>
    </form>
    <div id="confirmResult"></div>
  `;
}

function getMetricasTemplate() {
  const visibleEvents = getVisibleEvents();
  const totalGuests = visibleEvents.reduce((sum, event) => sum + event.guestEmails.length, 0);
  const totalConfirmed = visibleEvents.reduce((sum, event) => sum + event.confirmations.filter((item) => item.status === "Confirmado").length, 0);

  return `
    <div class="admin-grid">
      <article class="metric-card"><strong>${users.length}</strong><span>Usuarios en base_usuarios</span></article>
      <article class="metric-card"><strong>${visibleEvents.length}</strong><span>Eventos visibles para tu rol</span></article>
      <article class="metric-card"><strong>${totalConfirmed}/${totalGuests}</strong><span>Invitados confirmados</span></article>
    </div>
  `;
}

function getUsuariosTemplate() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>CWID</th>
            <th>Nombre</th>
            <th>Mail</th>
            <th>Rol</th>
            <th>Función</th>
            <th>Squad</th>
            <th>CECO</th>
            <th>Cuenta mayor</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (user) => `
                <tr>
                  <td>${escapeHtml(user.CWID)}</td>
                  <td>${escapeHtml(user.Nombre)} ${escapeHtml(user.Apellido)}</td>
                  <td>${escapeHtml(user.mail)}</td>
                  <td>${escapeHtml(user.rol)}</td>
                  <td>${escapeHtml(user.funcion)}</td>
                  <td>${escapeHtml(user.squad)}</td>
                  <td>${escapeHtml(user.ceco || "-")}</td>
                  <td>${escapeHtml(user.cuenta_mayor || "-")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getInstalarTemplate() {
  return `
    <div class="placeholder-panel">
      <h2>Instalar la app</h2>
      <p>Esta versión ya incluye manifest para evolucionarla como app instalable. En el siguiente paso podemos sumar íconos finales y service worker para una experiencia PWA completa.</p>
    </div>
  `;
}

function getEventCard(event) {
  return `
    <article class="event-card">
      <div class="event-card-header">
        <div>
          <span class="event-code">${event.id}</span>
          <h2>${escapeHtml(event.subject)}</h2>
        </div>
        <span class="status-pill">${event.confirmations.length}/${event.guestEmails.length} confirmados</span>
      </div>
      <div class="event-meta">
        <span>${formatDateTime(event.startDate, event.startTime)} a ${formatDateTime(event.endDate, event.endTime)}</span>
        <span>${escapeHtml(event.topic)}</span>
        <span>Creado por ${escapeHtml(event.creatorName)}</span>
      </div>
      <div class="event-flags">
        <span>Coffee: ${event.coffee}</span>
        <span>Oradores: ${event.speakers}</span>
        <span>Feedback: ${event.feedback === "Sí" ? `${event.feedback} (${event.feedbackType})` : event.feedback}</span>
      </div>
      <details>
        <summary>Ver invitados y confirmaciones</summary>
        <div class="details-grid">
          <div>
            <h3>Invitados</h3>
            <p>${event.guestEmails.map(escapeHtml).join(", ")}</p>
          </div>
          <div>
            <h3>Confirmaciones</h3>
            ${
              event.confirmations.length
                ? `<ul>${event.confirmations.map((item) => `<li>${escapeHtml(item.name)} - ${escapeHtml(item.email)} - ${item.status}</li>`).join("")}</ul>`
                : "<p>Sin confirmaciones todavía.</p>"
            }
          </div>
        </div>
      </details>
      <div class="card-actions">
        <a class="secondary-button" href="${buildGuestMailto(event)}">Enviar mail a invitados</a>
        <a class="secondary-button" href="${buildCarlaMailto(event)}">Avisar a Carla</a>
        <button class="danger-button" type="button" data-delete-event="${event.id}">Eliminar evento</button>
      </div>
    </article>
  `;
}

function createEvent(formData) {
  const feedback = formData.get("feedback");
  const event = {
    id: `CB-${Date.now().toString().slice(-6)}`,
    creatorCwid: currentUser.CWID,
    creatorName: `${currentUser.Nombre} ${currentUser.Apellido}`,
    creatorEmail: currentUser.mail,
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    endDate: formData.get("endDate"),
    endTime: formData.get("endTime"),
    topic: formData.get("topic"),
    subject: formData.get("subject"),
    coffee: formData.get("coffee"),
    speakers: formData.get("speakers"),
    feedback,
    feedbackType: feedback === "Sí" ? formData.get("feedbackType") : "No aplica",
    guestEmails: parseEmails(formData.get("guestEmails")),
    confirmations: [],
    createdAt: new Date().toISOString()
  };

  events.push(event);
  saveEvents();
  return event;
}

function parseEmails(value) {
  return [...new Set(value.split(/[,\n;]/).map((email) => email.trim()).filter(Boolean))];
}

function buildGuestMailto(event) {
  const confirmLink = `${window.location.origin}${window.location.pathname}?section=confirmar&event=${encodeURIComponent(event.id)}`;
  const subject = `Invitación Campus Bayer - ${event.subject}`;
  const body = [
    `Hola,`,
    ``,
    `Te invitamos al evento "${event.subject}" en Campus Bayer Pergamino.`,
    `Eje temático: ${event.topic}`,
    `Inicio: ${formatDateTime(event.startDate, event.startTime)}`,
    `Fin: ${formatDateTime(event.endDate, event.endTime)}`,
    ``,
    `Confirmá tu asistencia desde este link:`,
    confirmLink,
    ``,
    `Código de evento: ${event.id}`
  ].join("\n");

  return `mailto:${event.guestEmails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildCarlaMailto(event) {
  const subject = `Nuevo evento creado - ${event.subject}`;
  const body = [
    `Se creó un nuevo evento en Campus Bayer Pergamino.`,
    ``,
    `Código: ${event.id}`,
    `Asunto: ${event.subject}`,
    `Organizador: ${event.creatorName} (${event.creatorEmail})`,
    `Inicio: ${formatDateTime(event.startDate, event.startTime)}`,
    `Fin: ${formatDateTime(event.endDate, event.endTime)}`,
    `Coffee: ${event.coffee}`,
    `Oradores: ${event.speakers}`,
    `Solicita feedback: ${event.feedback}`,
    `Tipo de feedback: ${event.feedbackType}`,
    `Cantidad de invitados: ${event.guestEmails.length}`
  ].join("\n");

  return `mailto:${CARLA_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderMailPanel(event) {
  const panel = document.querySelector("#mailPanel");
  if (!panel) return;

  panel.hidden = false;
  panel.innerHTML = `
    <h2>Evento creado y registrado en calendario</h2>
    <p>Se generó el código <strong>${event.id}</strong>. Para este prototipo estático, el envío se hace abriendo borradores de mail con el detalle precargado.</p>
    <div class="mail-actions">
      <a class="primary-button" href="${buildGuestMailto(event)}">Abrir mail a invitados</a>
      <a class="secondary-button" href="${buildCarlaMailto(event)}">Abrir mail a Carla</a>
    </div>
  `;
}

function confirmAttendance(formData) {
  const eventId = formData.get("eventId").trim();
  const event = events.find((item) => item.id.toUpperCase() === eventId.toUpperCase());
  if (!event) return { ok: false, message: "No encontré un evento con ese código." };

  const email = formData.get("email").trim().toLowerCase();
  const confirmation = {
    email,
    name: formData.get("name").trim(),
    status: formData.get("status"),
    confirmedAt: new Date().toISOString()
  };

  const existingIndex = event.confirmations.findIndex((item) => item.email.toLowerCase() === email);
  if (existingIndex >= 0) {
    event.confirmations[existingIndex] = confirmation;
  } else {
    event.confirmations.push(confirmation);
  }

  saveEvents();
  return { ok: true, message: "Confirmación guardada. Gracias." };
}

function formatDateTime(date, time) {
  return `${date} ${time}`;
}

function formatDay(date) {
  return date ? date.slice(-2) : "--";
}

function formatMonth(date) {
  if (!date) return "";
  const month = Number(date.slice(5, 7));
  return ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"][month - 1] || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getIcon(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/></svg>',
    "calendar-plus": '<svg viewBox="0 0 24 24"><path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 9h16"/><path d="M5 5h14v15H5z"/><path d="M12 13v5"/><path d="M9.5 15.5h5"/></svg>',
    "list-check": '<svg viewBox="0 0 24 24"><path d="m4 7 2 2 4-4"/><path d="M12 7h8"/><path d="m4 15 2 2 4-4"/><path d="M12 15h8"/></svg>',
    "check-circle": '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z"/><path d="m8 12 3 3 5-6"/></svg>',
    "calendar-days": '<svg viewBox="0 0 24 24"><path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 9h16"/><path d="M5 5h14v15H5z"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg>',
    "message-square": '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="m3 11 18-8-8 18-2-7z"/><path d="m11 14 10-11"/></svg>',
    "clipboard-check": '<svg viewBox="0 0 24 24"><path d="M9 4h6l1 2h3v15H5V6h3z"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="m8 13 2.5 2.5L16 10"/></svg>',
    "bar-chart": '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>'
  };
  return icons[name] || icons.home;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const cwid = normalizeCwid(cwidInput.value);
  const user = findUser(cwid);

  if (!user) {
    formMessage.textContent = "No encontré ese CWID en base_usuarios.";
    return;
  }

  formMessage.textContent = "";
  login(user);
});

navList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) return;
  renderSection(button.dataset.section);
  sidebar.classList.remove("open");
});

sectionContent.addEventListener("change", (event) => {
  if (event.target.name !== "feedback") return;
  const feedbackOptions = document.querySelector("#feedbackOptions");
  if (feedbackOptions) feedbackOptions.hidden = event.target.value !== "Sí";
});

sectionContent.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;

  if (form.id === "eventForm") {
    const newEvent = createEvent(new FormData(form));
    form.reset();
    document.querySelector("#feedbackOptions").hidden = true;
    renderMailPanel(newEvent);
    return;
  }

  if (form.id === "confirmForm") {
    const result = confirmAttendance(new FormData(form));
    const resultBox = document.querySelector("#confirmResult");
    resultBox.innerHTML = `<div class="${result.ok ? "success-panel" : "error-panel"}">${result.message}</div>`;
  }
});

sectionContent.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-event]");
  if (!deleteButton) return;

  const eventId = deleteButton.dataset.deleteEvent;
  events = events.filter((item) => item.id !== eventId);
  saveEvents();
  renderSection(currentSection);
});

logoutButton.addEventListener("click", logout);

menuButton.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") sidebar.classList.remove("open");
});

await loadUsers();
loadEvents();
cwidInput.focus();
