const SUPABASE_URL = "https://mgudkhkhyfbvhjprvhuu.supabase.co";
const SUPABASE_KEY = "sb_publishable_SDBd47JOp16ZbHL5obZEzQ_lBq6Gkb_";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = { usuarios: "usuarios_app", eventos: "eventos", asistentes: "asistentes_eventos", asistencia: "asistencia" };
let currentUser = null;
let eventosCache = [];
let asistentesCache = [];
let html5QrCode = null;
const $ = (id) => document.getElementById(id);

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = $("btnInstallApp");
  if (btn) btn.disabled = false;
});

async function installApp() {
  const btn = $("btnInstallApp");
  if (!deferredInstallPrompt) {
    alert("Si el navegador no muestra la instalación automática, usá el menú del navegador y elegí 'Instalar app' o 'Agregar a pantalla de inicio'.");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (btn) btn.textContent = "Instalada / disponible";
}

const clean = (v) => (v ?? "").toString().trim();
const norm = (v) => clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function setMsg(id, text) { $(id).textContent = text || ""; }
function eventCode(ev) { return ev?.numero_evento || ev?.codigo_evento || (ev?.id ? `EVT-${String(ev.id).slice(0,6).toUpperCase()}` : "EVT"); }
function eventStart(ev) { return ev?.fecha_inicio || ev?.inicio || ev?.fecha || ""; }
function eventEnd(ev) { return ev?.fecha_fin || ev?.fin || ""; }
function formatDateTime(value) {
  if (!value) return "Sin fecha";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function canEdit(role, funcion) {
  const r = norm(role);
  const f = norm(funcion);
  return ["administradora", "administrador", "admin", "edicion", "edición", "organizador"].includes(r)
    || ["admin", "organizador"].includes(f);
}

async function loginInterno() {
  const usuario = clean($("usuarioInput").value);
  setMsg("loginMsg", "");
  if (!usuario) return setMsg("loginMsg", "Ingresá tu CWID / usuario.");
  const { data, error } = await supabaseClient.from(TABLES.usuarios).select("*").ilike("usuario", usuario).eq("activo", true).maybeSingle();
  if (error) return setMsg("loginMsg", `Error de conexión: ${error.message}`);
  if (!data) return setMsg("loginMsg", "Usuario no encontrado o inactivo.");
  currentUser = data; enterApp(data);
}

function loginVisitante() { currentUser = { usuario: "visitante", nombre: "Visitante", rol: "visitante", funcion: "Consulta" }; enterApp(currentUser); }

function enterApp(user) {
  $("loginScreen").classList.add("hidden"); $("homeScreen").classList.remove("hidden");
  $("userInfo").textContent = `${user.nombre} · ${user.rol} · ${user.funcion}`;
  applyRole(user); loadEvents();
}

function applyRole(user) {
  const editable = canEdit(user?.rol, user?.funcion);
  document.body.classList.toggle("visitor-mode", !editable);
  document.body.classList.toggle("admin-mode", editable);

  document.querySelectorAll(".role-admin,.role-edicion").forEach(el => {
    el.classList.toggle("no-permission", !editable);
  });

  // El visitante y los usuarios sin permisos siempre quedan en histórico de eventos.
  if (!editable) switchTab("historicoPanel");
  else switchTab("crearEventoPanel");
}

function switchTab(target) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.target === target));
  document.querySelectorAll(".view").forEach(v => { v.classList.add("hidden"); v.classList.remove("active-view"); });
  $(target).classList.remove("hidden"); $(target).classList.add("active-view");
}

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.target)));

async function loadEvents() {
  // No ordenamos por created_at para evitar errores cuando la columna no existe o no está en cache.
  const { data, error } = await supabaseClient.from(TABLES.eventos).select("*");
  if (error) { $("eventsList").innerHTML = `<p>No se pudo leer eventos: ${error.message}</p>`; return; }
  eventosCache = (data || []).sort((a, b) => new Date(eventStart(b) || 0) - new Date(eventStart(a) || 0));
  renderEvents();
  fillEventSelects();
  renderCalendar();
}

function renderEvents() {
  if (!eventosCache.length) { $("eventsList").innerHTML = `<p>Todavía no hay eventos cargados.</p>`; return; }
  $("eventsList").innerHTML = eventosCache.map(ev => `
    <div class="event-item">
      <strong>${ev.evento || "Sin nombre"}</strong>
      <span>🕘 Inicio: ${formatDateTime(eventStart(ev))}</span>
      <span>🏁 Fin: ${formatDateTime(eventEnd(ev))}</span>
      <span>🏷️ ${ev.tematica || "Sin temática"} · 📍 ${ev.lugar || "Sin lugar"} · ${ev.modalidad || "Sin modalidad"}</span>
      <small>${eventCode(ev)}</small>
    </div>`).join("");
}

function fillEventSelects() {
  const html = eventosCache.map(ev => `<option value="${ev.id}">${eventCode(ev)} · ${ev.evento || "Evento"} · ${formatDateTime(eventStart(ev))}</option>`).join("");
  ["eventoCargaSelect","eventoAsistenciaSelect","eventoMetricasSelect"].forEach(id => $(id).innerHTML = html || `<option value="">Sin eventos</option>`);
}

async function saveEvent() {
  const inicio = $("inicioEvento").value;
  const fin = $("finEvento").value;
  const payload = {
    fecha_inicio: inicio || null,
    fecha_fin: fin || null,
    evento: clean($("nombreEvento").value),
    lugar: clean($("lugarEvento").value),
    tematica: clean($("tematicaEvento").value),
    modalidad: clean($("modalidadEvento").value),
    detalles: clean($("detallesEvento").value),
    creado_por: currentUser?.usuario || null
  };
  if (!payload.fecha_inicio || !payload.fecha_fin || !payload.evento) return setMsg("eventMsg", "Completá inicio, fin y nombre del evento.");
  if (new Date(payload.fecha_fin) < new Date(payload.fecha_inicio)) return setMsg("eventMsg", "El fin del evento no puede ser anterior al inicio.");
  const { error } = await supabaseClient.from(TABLES.eventos).insert(payload);
  if (error) return setMsg("eventMsg", `Error: ${error.message}`);
  setMsg("eventMsg", "Evento guardado correctamente. Ya podés cargar asistentes ahora o más adelante.");
  ["inicioEvento","finEvento","nombreEvento","lugarEvento","tematicaEvento","detallesEvento"].forEach(id => { if ($(id)) $(id).value = ""; });
  await loadEvents();
}

async function readExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function getVal(row, names) { const keys = Object.keys(row); for (const n of names) { const k = keys.find(x => norm(x) === norm(n)); if (k) return row[k]; } return ""; }
function qrCodeFor(row, ev) {
  const tipo = norm(getVal(row, ["interno/externo", "interno_externo"]));
  const cwid = clean(getVal(row, ["cwid"])).toUpperCase();
  const nombre = clean(getVal(row, ["nombre"])); const apellido = clean(getVal(row, ["apellido"]));
  const numero = clean(getVal(row, ["N°", "N", "numero"]));
  const pref = eventCode(ev);
  if (tipo.includes("intern") && cwid) return `${pref}-${cwid}`;
  const ext = `${nombre.substring(0,3)}${apellido.substring(0,3)}`.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `${pref}-${ext || "EXT"}-${numero || Date.now()}`;
}



function initCalendarMonth() {
  const input = $("calendarMonth");
  if (!input || input.value) return;
  const d = new Date();
  input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sameMonth(value, year, monthIndex) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === monthIndex;
}

function eventsForDay(dateObj) {
  return eventosCache.filter(ev => {
    const start = new Date(eventStart(ev));
    const end = eventEnd(ev) ? new Date(eventEnd(ev)) : start;
    if (Number.isNaN(start.getTime())) return false;
    const dayStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
    const dayEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);
    return start <= dayEnd && end >= dayStart;
  }).sort((a,b) => new Date(eventStart(a)) - new Date(eventStart(b)));
}

function renderCalendar() {
  initCalendarMonth();
  const input = $("calendarMonth");
  const grid = $("calendarGrid");
  if (!input || !grid || !input.value) return;
  const [year, month] = input.value.split("-").map(Number);
  const monthIndex = month - 1;
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const monthLabel = first.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  $("calendarTitle").textContent = `Calendario de actividades · ${monthLabel}`;

  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const leading = (first.getDay() + 6) % 7;
  const cells = [];
  weekdays.forEach(w => cells.push(`<div class="calendar-weekday">${w}</div>`));
  for (let i = 0; i < leading; i++) cells.push(`<div class="calendar-cell muted-cell"></div>`);
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(year, monthIndex, day);
    const evs = eventsForDay(d);
    cells.push(`<div class="calendar-cell"><div class="day-number">${day}</div>${evs.map(ev => `
      <div class="calendar-event">
        <strong>${ev.evento || "Evento"}</strong>
        <span>${formatDateTime(eventStart(ev)).replace(/^\d{2}\/\d{2}\/\d{4},?\s*/, "")} · ${ev.lugar || "Sin lugar"}</span>
      </div>`).join("")}</div>`);
  }
  grid.innerHTML = cells.join("");
}

async function exportCalendarPdf() {
  renderCalendar();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const input = $("calendarMonth");
  const [year, month] = input.value.split("-").map(Number);
  const monthIndex = month - 1;
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const monthLabel = first.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const gridW = pageW - margin * 2;
  const cellW = gridW / 7;
  const headerH = 9;
  const cellH = 24;
  let y = 18;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Campus Bayer", margin, 10);
  pdf.setFontSize(12);
  pdf.text(`Calendario de actividades · ${monthLabel}`, margin, 16);

  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  pdf.setFontSize(9);
  weekdays.forEach((w, i) => {
    pdf.rect(margin + i * cellW, y, cellW, headerH);
    pdf.text(w, margin + i * cellW + 2, y + 6);
  });
  y += headerH;

  const leading = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((leading + last.getDate()) / 7) * 7;
  for (let idx = 0; idx < totalCells; idx++) {
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    const x = margin + col * cellW;
    const yy = y + row * cellH;
    pdf.rect(x, yy, cellW, cellH);
    const day = idx - leading + 1;
    if (day >= 1 && day <= last.getDate()) {
      const d = new Date(year, monthIndex, day);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(String(day), x + 2, yy + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      const evs = eventsForDay(d).slice(0, 3);
      evs.forEach((ev, j) => {
        const txt = `${ev.evento || "Evento"} · ${ev.lugar || ""}`.slice(0, 38);
        pdf.text(txt, x + 2, yy + 10 + j * 4);
      });
      if (eventsForDay(d).length > 3) pdf.text("+ más eventos", x + 2, yy + 22);
    }
  }
  pdf.save(`calendario-campus-bayer-${input.value}.pdf`);
}

function descargarMatrizAsistentes() {
  const eventId = $("eventoCargaSelect").value;
  const ev = eventosCache.find(e => e.id === eventId) || {};
  const headers = ["N°", "fecha", "evento", "interno/externo", "cwid", "nombre", "apellido", "rol", "funcion", "mail"];
  const exampleRows = [
    [1, eventStart(ev) || "", eventCode(ev), "interno", "", "", "", "", "", ""],
    [2, eventStart(ev) || "", eventCode(ev), "externo", "", "", "", "", "", ""]
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws["!cols"] = [
    { wch: 8 }, { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 },
    { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 28 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Matriz asistentes");
  XLSX.writeFile(wb, `matriz-asistentes-${eventCode(ev) || "campus-bayer"}.xlsx`);
}

async function uploadAsistentes() {
  const eventId = $("eventoCargaSelect").value; const file = $("excelInput").files[0];
  if (!eventId) return setMsg("uploadMsg", "Seleccioná un evento.");
  if (!file) return setMsg("uploadMsg", "Cargá un Excel o CSV.");
  const ev = eventosCache.find(e => e.id === eventId);
  const rows = await readExcelFile(file);
  const payload = rows.filter(r => clean(getVal(r,["nombre"]))).map(r => ({
    evento_id: eventId,
    numero: Number(clean(getVal(r,["N°","N","numero"]))) || null,
    interno_externo: clean(getVal(r,["interno/externo","interno_externo"])),
    cwid: clean(getVal(r,["cwid"])).toUpperCase() || null,
    nombre: clean(getVal(r,["nombre"])), apellido: clean(getVal(r,["apellido"])),
    rol: clean(getVal(r,["rol"])), funcion: clean(getVal(r,["funcion","función"])), mail: clean(getVal(r,["mail","email"])),
    codigo_qr: qrCodeFor(r, ev)
  }));
  if (!payload.length) return setMsg("uploadMsg", "No encontré filas válidas con nombre.");
  const { error } = await supabaseClient.from(TABLES.asistentes).insert(payload);
  if (error) return setMsg("uploadMsg", `Error al subir asistentes: ${error.message}`);
  setMsg("uploadMsg", `${payload.length} asistentes cargados.`); await loadAsistentes(eventId);
}

async function loadAsistentes(eventId) {
  const { data, error } = await supabaseClient.from(TABLES.asistentes).select("*").eq("evento_id", eventId).order("numero", { ascending: true });
  if (error) { setMsg("uploadMsg", error.message); return []; }
  asistentesCache = data || []; renderAsistentes(); return asistentesCache;
}

function renderAsistentes() {
  if (!asistentesCache.length) { $("asistentesPreview").innerHTML = ""; return; }
  $("asistentesPreview").innerHTML = `<table><thead><tr><th>N°</th><th>Nombre</th><th>Tipo</th><th>Rol</th><th>Función</th><th>QR</th></tr></thead><tbody>${asistentesCache.map(a => `<tr><td>${a.numero || ""}</td><td>${a.nombre} ${a.apellido || ""}</td><td>${a.interno_externo || ""}</td><td>${a.rol || ""}</td><td>${a.funcion || ""}</td><td>${a.codigo_qr}</td></tr>`).join("")}</tbody></table>`;
}

async function ensureAsistentesForSelected() { const id = $("eventoCargaSelect").value; return asistentesCache.length && asistentesCache[0].evento_id === id ? asistentesCache : await loadAsistentes(id); }

function showProgress(label, percent = 0) {
  const box = $("printProgress");
  if (!box) return;
  box.classList.remove("hidden");
  $("progressText").textContent = label;
  $("progressPercent").textContent = `${percent}%`;
  $("progressBar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
}
function hideProgressSoon(finalText = "Listo") {
  showProgress(finalText, 100);
  setTimeout(() => {
    const box = $("printProgress");
    if (box) box.classList.add("hidden");
  }, 1800);
}
function setPrintButtonsDisabled(disabled) {
  ["btnPdfQR", "btnPdfCredenciales", "btnPdfPulseras"].forEach(id => { if ($(id)) $(id).disabled = disabled; });
}
function waitFrame() { return new Promise(resolve => setTimeout(resolve, 0)); }

async function qrDataUrl(text) {
  if (!window.QRCode || typeof window.QRCode.toDataURL !== "function") {
    throw new Error("No se cargó la librería QRCode. Revisá conexión a internet o el CDN de qrcode.");
  }
  return await window.QRCode.toDataURL(text, { margin: 1, width: 220, errorCorrectionLevel: "M" });
}

async function makePdf(type) {
  const labelMap = { qr: "Generando QR individuales", cred: "Generando credenciales", pulsera: "Generando pulseras" };
  const fileMap = { qr: "qr-individuales", cred: "credenciales", pulsera: "pulseras" };
  try {
    setPrintButtonsDisabled(true);
    showProgress(labelMap[type] || "Generando archivo", 1);

    const data = await ensureAsistentesForSelected();
    if (!data.length) {
      showProgress("No hay asistentes cargados para este evento", 0);
      setMsg("uploadMsg", "No hay asistentes para generar. Primero cargá la lista del evento.");
      setPrintButtonsDisabled(false);
      return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error("No se cargó jsPDF. Revisá conexión a internet o el CDN de jsPDF.");

    const ev = eventosCache.find(e => e.id === $("eventoCargaSelect").value) || {};
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: type === "pulsera" ? "landscape" : "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setProperties({ title: `Campus Bayer - ${fileMap[type]}` });

    if (type === "qr") {
      const cols = 2, rows = 4;
      const cardW = (pageW - 20) / cols;
      const cardH = (pageH - 24) / rows;
      for (let i = 0; i < data.length; i++) {
        if (i > 0 && i % (cols * rows) === 0) pdf.addPage();
        const pos = i % (cols * rows);
        const x = 10 + (pos % cols) * cardW;
        const y = 14 + Math.floor(pos / cols) * cardH;
        const a = data[i];
        const qr = await qrDataUrl(a.codigo_qr);
        pdf.setDrawColor(210, 230, 238); pdf.roundedRect(x + 2, y, cardW - 4, cardH - 4, 3, 3);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text("Campus Bayer", x + 7, y + 8);
        pdf.addImage(qr, "PNG", x + 12, y + 13, 35, 35);
        pdf.setFontSize(9); pdf.text(`${a.nombre} ${a.apellido || ""}`.slice(0, 30), x + 7, y + 55);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.text(String(a.codigo_qr).slice(0, 34), x + 7, y + 62);
        showProgress(labelMap[type], Math.round(((i + 1) / data.length) * 100));
        if (i % 4 === 0) await waitFrame();
      }
    }

    if (type === "cred") {
      const cols = 2, rows = 4;
      const cardW = 86, cardH = 54;
      const startX = 14, startY = 18;
      for (let i = 0; i < data.length; i++) {
        if (i > 0 && i % (cols * rows) === 0) pdf.addPage();
        const pos = i % (cols * rows);
        const x = startX + (pos % cols) * 94;
        const y = startY + Math.floor(pos / cols) * 64;
        const a = data[i];
        const qr = await qrDataUrl(a.codigo_qr);
        pdf.setDrawColor(0, 188, 255); pdf.roundedRect(x, y, cardW, cardH, 4, 4);
        pdf.setFillColor(238, 249, 253); pdf.rect(x, y, cardW, 12, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text("Campus Bayer", x + 5, y + 8);
        pdf.setFontSize(12); pdf.text(`${a.nombre} ${a.apellido || ""}`.slice(0, 24), x + 5, y + 22);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
        pdf.text(`Rol: ${a.rol || "-"}`.slice(0, 28), x + 5, y + 31);
        pdf.text(`Función: ${a.funcion || "-"}`.slice(0, 28), x + 5, y + 38);
        pdf.text(`${ev.evento || "Evento"}`.slice(0, 26), x + 5, y + 47);
        pdf.addImage(qr, "PNG", x + 57, y + 17, 24, 24);
        showProgress(labelMap[type], Math.round(((i + 1) / data.length) * 100));
        if (i % 4 === 0) await waitFrame();
      }
    }

    if (type === "pulsera") {
      const rows = 7;
      const bandH = 24;
      for (let i = 0; i < data.length; i++) {
        if (i > 0 && i % rows === 0) pdf.addPage();
        const pos = i % rows;
        const x = 12;
        const y = 14 + pos * 27;
        const a = data[i];
        const qr = await qrDataUrl(a.codigo_qr);
        pdf.setDrawColor(210, 230, 238); pdf.roundedRect(x, y, pageW - 24, bandH, 3, 3);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("Campus Bayer", x + 7, y + 8);
        pdf.setFontSize(10); pdf.text(`${a.nombre} ${a.apellido || ""}`.slice(0, 36), x + 45, y + 9);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.text(`${eventCode(ev)} · ${a.codigo_qr}`.slice(0, 70), x + 45, y + 17);
        pdf.addImage(qr, "PNG", pageW - 35, y + 3, 18, 18);
        showProgress(labelMap[type], Math.round(((i + 1) / data.length) * 100));
        if (i % 3 === 0) await waitFrame();
      }
    }

    pdf.save(`campus-bayer-${fileMap[type] || type}.pdf`);
    setMsg("uploadMsg", `${labelMap[type]}: archivo generado correctamente.`);
    hideProgressSoon("Archivo generado");
  } catch (err) {
    console.error(err);
    setMsg("uploadMsg", `Error al generar: ${err.message}`);
    showProgress(`Error: ${err.message}`, 0);
  } finally {
    setPrintButtonsDisabled(false);
  }
}

async function registrarAsistencia(codigo) {
  const eventId = $("eventoAsistenciaSelect").value; const qr = clean(codigo);
  if (!eventId || !qr) return setMsg("scanMsg", "Seleccioná evento e ingresá/escaneá un código.");
  const { data: asis, error: e1 } = await supabaseClient.from(TABLES.asistentes).select("*").eq("evento_id", eventId).eq("codigo_qr", qr).maybeSingle();
  if (e1) return setMsg("scanMsg", e1.message); if (!asis) return setMsg("scanMsg", "QR no corresponde a este evento.");
  const payload = { evento_id: eventId, asistente_id: asis.id, codigo_qr: qr, estado: "presente", registrado_por: currentUser?.usuario || null };
  const { error } = await supabaseClient.from(TABLES.asistencia).insert(payload);
  if (error) return setMsg("scanMsg", `Error al registrar: ${error.message}`);
  setMsg("scanMsg", `Presente: ${asis.nombre} ${asis.apellido || ""}`); $("manualQr").value = "";
}

async function startScan() {
  $("reader").classList.remove("hidden"); html5QrCode = new Html5Qrcode("reader");
  await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async decodedText => { await registrarAsistencia(decodedText); }, () => {});
}
async function stopScan() { if (html5QrCode) { await html5QrCode.stop(); html5QrCode.clear(); } $("reader").classList.add("hidden"); }

async function calcMetricas() {
  const eventId = $("eventoMetricasSelect").value; const asistentes = await loadAsistentes(eventId);
  const { data: asistencias, error } = await supabaseClient.from(TABLES.asistencia).select("*").eq("evento_id", eventId);
  if (error) return $("metricsCards").innerHTML = `<p>${error.message}</p>`;
  const presentesSet = new Set((asistencias || []).map(a => a.asistente_id));
  const invitados = asistentes.length, presentes = presentesSet.size, ausentes = invitados - presentes;
  const pct = invitados ? Math.round((presentes/invitados)*100) : 0;
  $("metricsCards").innerHTML = `<div><strong>${invitados}</strong><span>Invitados</span></div><div><strong>${presentes}</strong><span>Presentes</span></div><div><strong>${ausentes}</strong><span>Ausentes</span></div><div><strong>${pct}%</strong><span>Asistencia</span></div>`;
  $("metricsDetail").innerHTML = `<table><thead><tr><th>Nombre</th><th>Rol</th><th>Función</th><th>Estado</th></tr></thead><tbody>${asistentes.map(a => `<tr><td>${a.nombre} ${a.apellido || ""}</td><td>${a.rol || ""}</td><td>${a.funcion || ""}</td><td>${presentesSet.has(a.id) ? "Presente" : "Ausente"}</td></tr>`).join("")}</tbody></table>`;
}

async function exportAsistenciaCsv() {
  const eventId = $("eventoAsistenciaSelect").value; const asistentes = await loadAsistentes(eventId);
  const { data: asistencias } = await supabaseClient.from(TABLES.asistencia).select("*").eq("evento_id", eventId);
  const presentes = new Set((asistencias || []).map(a => a.asistente_id));
  const rows = [["evento_id","nombre","apellido","rol","funcion","codigo_qr","estado"]].concat(asistentes.map(a => [eventId,a.nombre,a.apellido||"",a.rol||"",a.funcion||"",a.codigo_qr,presentes.has(a.id)?"presente":"ausente"]));
  const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"})); const a = document.createElement("a"); a.href = url; a.download = "asistencia-campus-bayer.csv"; a.click(); URL.revokeObjectURL(url);
}

if ($("btnInstallApp")) $("btnInstallApp").addEventListener("click", installApp);
$("btnLogin").addEventListener("click", loginInterno); $("btnVisitante").addEventListener("click", loginVisitante); $("btnLogout").addEventListener("click", () => location.reload());
$("refreshEvents").addEventListener("click", loadEvents); if ($("refreshEventsHistorico")) $("refreshEventsHistorico").addEventListener("click", loadEvents); $("saveEvent").addEventListener("click", saveEvent); $("btnDescargarMatriz").addEventListener("click", descargarMatrizAsistentes); $("uploadAsistentes").addEventListener("click", uploadAsistentes);
if ($("btnRenderCalendar")) $("btnRenderCalendar").addEventListener("click", renderCalendar);
if ($("btnPdfCalendar")) $("btnPdfCalendar").addEventListener("click", exportCalendarPdf);
if ($("calendarMonth")) $("calendarMonth").addEventListener("change", renderCalendar);
$("eventoCargaSelect").addEventListener("change", e => loadAsistentes(e.target.value));
$("btnPdfQR").addEventListener("click", () => makePdf("qr")); $("btnPdfCredenciales").addEventListener("click", () => makePdf("cred")); $("btnPdfPulseras").addEventListener("click", () => makePdf("pulsera"));
$("btnManualCheckin").addEventListener("click", () => registrarAsistencia($("manualQr").value)); $("btnStartScan").addEventListener("click", startScan); $("btnStopScan").addEventListener("click", stopScan);
$("btnCalcMetricas").addEventListener("click", calcMetricas); $("btnExportAsistencia").addEventListener("click", exportAsistenciaCsv);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
