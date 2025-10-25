/* ===== Config ===== */
const EXPERIENCE_JSON = "data/experience.json";
const SKILLS_JSON = "data/skills.json";

/* ===== Tuning ===== */
const ORDER_DEFAULT = "desc";            // "asc" oldest→newest | "desc" newest→oldest
const TIME_SLOWNESS_EXP = 4;             // bigger = slower time motion near the top
const PX_PER_MONTH = 1400;               // page height density (very slow time)
const ACTIVE_TOP_PX = 200;               // px below header where active cards pin

/* ===== State ===== */
let entries = [];
let skills = [];
let order = ORDER_DEFAULT;
let minDate, maxDate;
let lastProgress = 0;

/* ===== Helpers ===== */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const parseDate = (s) => (!s ? null : new Date(s.length === 7 ? s + "-01T00:00:00" : s));
const fmt = (d) => d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "Present";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slowProgress = (p, k = TIME_SLOWNESS_EXP) => Math.pow(p, k);
const MS_PER_MONTH = 2629800000; // ~30.44 days

function byOrder(a, b) {
  return order === "asc"
    ? parseDate(a.start) - parseDate(b.start)
    : parseDate(b.start) - parseDate(a.start);
}

/* ===== Layout sizing from date span ===== */
function computeRange() {
  const today = new Date();
  const starts = entries.map((e) => parseDate(e.start)).filter(Boolean);
  const ends   = entries.map((e) => parseDate(e.end) || today);
  if (!starts.length) {
    const now = new Date();
    minDate = new Date(now.getFullYear() - 1, 0, 1);
    maxDate = new Date(now.getFullYear() + 1, 0, 1);
    return;
  }
  minDate = new Date(Math.min(...starts));
  maxDate = new Date(Math.max(...ends));
}

function sizeTimelineByDates() {
  const months = Math.max(1, (maxDate - minDate) / MS_PER_MONTH);
  const spanPx = months * PX_PER_MONTH;
  const minViewport = window.innerHeight * 1.5; // ensure some scroll room
  const totalHeight = Math.max(spanPx, minViewport);
  const wrap = $("#timelineWrap");
  wrap.style.height = `${Math.round(totalHeight)}px`;
}

/* ===== Build timeline (always-visible) ===== */
function buildTimeline() {
  const zone = $("#timelineZone");
  zone.innerHTML = "";
  entries.sort(byOrder).forEach((e, i) => {
    const el = document.createElement("article");
    el.className = "entry inactive";
    el.dataset.id    = e.id ?? String(i);
    el.dataset.start = e.start || "";
    el.dataset.end   = e.end   || "";
    el.innerHTML = `
      <div class="meta">${fmt(parseDate(e.start))} — ${fmt(parseDate(e.end))} · ${e.location || ""}</div>
      <h3>${e.title} · ${e.company || ""}</h3>
      <p>${e.summary || ""}</p>
      <div class="tags">${(e.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    `;
    zone.appendChild(el);
  });
}

/* ===== Scroll-time mapping ===== */
function currentDateFromScroll() {
  const wrap = $("#timelineWrap");
  const docH = document.documentElement.clientHeight;
  const pageY = window.scrollY + docH / 2;
  const wrapTop = wrap.offsetTop;
  const wrapBottom = wrapTop + wrap.scrollHeight - docH;

  const linear = clamp((pageY - wrapTop) / Math.max(1, (wrapBottom - wrapTop)), 0, 1);
  const prog = slowProgress(linear); // slow it down nonlinearly
  lastProgress = prog;

  const t0 = minDate.getTime();
  const t1 = maxDate.getTime();
  const t = (order === "asc")
    ? t0 + prog * (t1 - t0)      // top→bottom = oldest→newest
    : t1 - prog * (t1 - t0);     // top→bottom = newest→oldest

  return new Date(t);
}

function updateRailUI(date, progress) {
  $("#cursorOut").textContent   = fmt(date);
  $("#cursorBadge").textContent = fmt(date);
  const fill = (order === "asc") ? progress : (1 - progress);
  $("#railFill").style.height = (fill * 100).toFixed(1) + "%";
}

/* ===== Active state (lights up + expands + pins) ===== */
function updateActiveStates(now) {
  const nowT = now.getTime();
  const today = new Date();

  $$("#timelineZone .entry").forEach((el) => {
    const start = parseDate(el.dataset.start);
    const end   = parseDate(el.dataset.end) || today;
    if (!start) return;

    const active = (order === "asc")
      ? (nowT >= start.getTime() && nowT < end.getTime())
      : (nowT <= start.getTime() && nowT > end.getTime()); // symmetric for desc

    if (active) {
      el.classList.add("active");
      el.classList.remove("inactive");
    } else {
      el.classList.remove("active");
      el.classList.add("inactive");
    }
  });
}

/* ===== Tabs ===== */
function setTab(tab) {
  const expBtn = $("#tab-experience"), sklBtn = $("#tab-skills");
  const exp = $("#experience"), skl = $("#skills");
  if (tab === "experience") {
    expBtn.classList.add("active");   expBtn.setAttribute("aria-selected","true");
    sklBtn.classList.remove("active");sklBtn.setAttribute("aria-selected","false");
    skl.classList.add("hidden");      exp.classList.remove("hidden");
  } else {
    sklBtn.classList.add("active");   sklBtn.setAttribute("aria-selected","true");
    expBtn.classList.remove("active");expBtn.setAttribute("aria-selected","false");
    exp.classList.add("hidden");      skl.classList.remove("hidden");
  }
}

/* ===== Skills ===== */
function renderSkills() {
  const grid = $("#skillsGrid");
  grid.innerHTML = "";
  skills.forEach((s, i) => {
    const card = document.createElement("article");
    card.className = "skill-card";
    card.innerHTML = `
      <h4>${s.title}</h4>
      <div class="badges">${(s.items || []).map((x) => `<span class="badge">${x}</span>`).join("")}</div>`;
    grid.appendChild(card);
    setTimeout(() => card.classList.add("show"), 80 * i);
  });
}

/* ===== Header height var ===== */
function setHeaderVars() {
  const h = $("#topbar")?.offsetHeight || 0;
  document.documentElement.style.setProperty("--headerH", `${h}px`);
  document.documentElement.style.setProperty("--activeTop", `${ACTIVE_TOP_PX}px`);
}

/* ===== Main update loop ===== */
function tick() {
  const now = currentDateFromScroll();
  updateRailUI(now, lastProgress);
  updateActiveStates(now);
}

/* ===== Boot ===== */
async function boot() {
  $("#year").textContent = new Date().getFullYear();
  setHeaderVars();
  window.addEventListener("resize", setHeaderVars);

  const [expRes, sklRes] = await Promise.all([
    fetch(EXPERIENCE_JSON, { cache: "no-store" }),
    fetch(SKILLS_JSON, { cache: "no-store" })
  ]);
  if (!expRes.ok) throw new Error(`Failed to load ${EXPERIENCE_JSON}: ${expRes.status}`);
  if (!sklRes.ok) throw new Error(`Failed to load ${SKILLS_JSON}: ${sklRes.status}`);

  entries = (await expRes.json()).filter((e) => e && e.start);
  skills  = await sklRes.json();

  computeRange();
  sizeTimelineByDates();   // ← height based on date span
  buildTimeline();
  renderSkills();

  tick(); // initial
  window.addEventListener("scroll", tick, { passive: true });
  window.addEventListener("resize", () => { sizeTimelineByDates(); tick(); });

  $("#orderSelect").value = order;
  $("#orderSelect").addEventListener("change", (e) => {
    order = e.target.value;
    buildTimeline();       // keep all entries visible, just reorder
    tick();                // recompute mapping for new order
  });

  $("#tab-experience").addEventListener("click", () => setTab("experience"));
  $("#tab-skills").addEventListener("click", () => setTab("skills"));
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch(err => {
    console.error(err);
    const zone = $("#timelineZone");
    zone.innerHTML = `
      <article class="entry" style="background:#2a2f52;border:1px solid rgba(255,255,255,.2)">
        <h3>Couldn’t load your data</h3>
        <p>${String(err)}</p>
        <p style="opacity:.8">Check that <code>/data/experience.json</code> and <code>/data/skills.json</code> exist, are valid JSON, and paths match.</p>
      </article>
    `;
  });
});
