/* ===== Config ===== */
const EXPERIENCE_JSON = "data/experience.json";
const SKILLS_JSON = "data/skills.json";

/* ===== Settings ===== */
const TIME_SLOWNESS_EXP = 4; // Bigger = slower time change when scrolling
const ORDER_DEFAULT = "desc";

/* ===== State ===== */
let entries = [];
let skills = [];
let order = ORDER_DEFAULT;
let minDate, maxDate;
let lastProgress = 0;

/* ===== Helpers ===== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const parseDate = (s) => (!s ? null : new Date(s.length === 7 ? s + "-01" : s));
const fmt = (d) =>
  d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "Present";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slowProgress = (p, k = TIME_SLOWNESS_EXP) => Math.pow(p, k);

/* ===== Build timeline ===== */
function buildTimeline() {
  const zone = $("#timelineZone");
  zone.innerHTML = "";
  entries.sort(byOrder).forEach((e) => {
    const el = document.createElement("article");
    el.className = "entry";
    el.dataset.start = e.start;
    el.innerHTML = `
      <div class="meta">${fmt(parseDate(e.start))} — ${fmt(parseDate(e.end))} · ${e.location || ""}</div>
      <h3>${e.title} · ${e.company || ""}</h3>
      <p>${e.summary || ""}</p>
      <div class="tags">${(e.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</div>`;
    zone.appendChild(el);
  });
}

function byOrder(a, b) {
  return order === "asc"
    ? parseDate(a.start) - parseDate(b.start)
    : parseDate(b.start) - parseDate(a.start);
}

/* ===== Range and scroll mapping ===== */
function computeRange() {
  const today = new Date();
  const starts = entries.map((e) => parseDate(e.start));
  const ends = entries.map((e) => parseDate(e.end) || today);
  minDate = new Date(Math.min(...starts));
  maxDate = new Date(Math.max(...ends));
  minDate = new Date(minDate.getFullYear(), minDate.getMonth() - 6, 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 6, 1);
}

function currentDateFromScroll() {
  const wrap = $("#timelineWrap");
  const docH = document.documentElement.clientHeight;
  const pageY = window.scrollY + docH / 2;
  const wrapTop = wrap.offsetTop;
  const wrapBottom = wrapTop + wrap.scrollHeight - docH;
  const progLinear = clamp((pageY - wrapTop) / (wrapBottom - wrapTop), 0, 1);
  const prog = slowProgress(progLinear);
  lastProgress = prog;
  const t0 = minDate.getTime(),
    t1 = maxDate.getTime();
  const t = t0 + prog * (t1 - t0);
  return new Date(t);
}

function updateRailUI(date, progress) {
  $("#cursorOut").textContent = fmt(date);
  $("#cursorBadge").textContent = fmt(date);
  $("#railFill").style.height = (progress * 100).toFixed(1) + "%";
}

/* ===== Scroll updates ===== */
function updateByDate() {
  const now = currentDateFromScroll();
  updateRailUI(now, lastProgress);
  $$("#timelineZone .entry").forEach((el) => {
    const start = parseDate(el.dataset.start);
    if (now >= start) el.classList.add("revealed");
    else el.classList.remove("revealed");
  });
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
      <div class="badges">${(s.items || [])
        .map((x) => `<span class="badge">${x}</span>`)
        .join("")}</div>`;
    grid.appendChild(card);
    setTimeout(() => card.classList.add("show"), 80 * i);
  });
}

/* ===== Tabs ===== */
function setTab(tab) {
  const expBtn = $("#tab-experience"),
    sklBtn = $("#tab-skills"),
    exp = $("#experience"),
    skl = $("#skills");
  if (tab === "experience") {
    expBtn.classList.add("active");
    sklBtn.classList.remove("active");
    skl.classList.add("hidden");
    exp.classList.remove("hidden");
  } else {
    sklBtn.classList.add("active");
    expBtn.classList.remove("active");
    exp.classList.add("hidden");
    skl.classList.remove("hidden");
  }
}

/* ===== Boot ===== */
async function boot() {
  $("#year").textContent = new Date().getFullYear();
  const [expRes, sklRes] = await Promise.all([
    fetch(EXPERIENCE_JSON),
    fetch(SKILLS_JSON),
  ]);
  entries = (await expRes.json()).filter((e) => e.start);
  skills = await sklRes.json();
  computeRange();
  buildTimeline();
  renderSkills();
  updateByDate();
  window.addEventListener("scroll", updateByDate, { passive: true });
  window.addEventListener("resize", updateByDate);
  $("#orderSelect").addEventListener("change", (e) => {
    order = e.target.value;
    buildTimeline();
  });
  $("#tab-experience").addEventListener("click", () => setTab("experience"));
  $("#tab-skills").addEventListener("click", () => setTab("skills"));
}
document.addEventListener("DOMContentLoaded", boot);
