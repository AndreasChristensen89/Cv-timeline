/* ===== Config ===== */
const EXPERIENCE_JSON = "data/experience.json";
const SKILLS_JSON = "data/skills.json";

/* ===== Settings ===== */
const TIME_SLOWNESS_EXP = 4;          // Bigger = slower time when scrolling
const ORDER_DEFAULT = "desc";         // "asc" oldest→newest | "desc" newest→oldest
const CENTER_ON_FIRST_REVEAL = true;  // Center the card the first time it appears

/* ===== State ===== */
let entries = [];
let skills = [];
let order = ORDER_DEFAULT;
let minDate, maxDate;
let lastProgress = 0;
const revealedOnce = new Set();       // remember which IDs have been revealed at least once

/* ===== Helpers ===== */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const parseDate = (s) => (!s ? null : new Date(s.length === 7 ? s + "-01T00:00:00" : s));
const fmt = (d) => d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "Present";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slowProgress = (p, k = TIME_SLOWNESS_EXP) => Math.pow(p, k);

function byOrder(a, b) {
  return order === "asc"
    ? parseDate(a.start) - parseDate(b.start)
    : parseDate(b.start) - parseDate(a.start);
}

/* ===== Build timeline (stable DOM order) ===== */
function buildTimeline() {
  const zone = $("#timelineZone");
  zone.innerHTML = "";
  entries.sort(byOrder).forEach((e, i) => {
    const el = document.createElement("article");
    el.className = "entry";
    el.dataset.id    = e.id ?? String(i);
    el.dataset.start = e.start || "";
    el.dataset.end   = e.end   || "";
    el.innerHTML = `
      <div class="meta">${fmt(parseDate(e.start))} — ${fmt(parseDate(e.end))} · ${e.location || ""}</div>
      <h3>${e.title} · ${e.company || ""}</h3>
      <p>${e.summary || ""}</p>
      <div class="tags">${(e.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    `;
    // Keep previously revealed cards visible after rebuild/sort
    if (revealedOnce.has(el.dataset.id)) el.classList.add("revealed");
    zone.appendChild(el);
  });
}

/* ===== Range & scroll mapping ===== */
function computeRange() {
  const today = new Date();
  const starts = entries.map((e) => parseDate(e.start)).filter(Boolean);
  const ends   = entries.map((e) => parseDate(e.end) || today);
  if (!starts.length) {
    const now = new Date();
    minDate = new Date(now.getFullYear() - 5, 0, 1);
    maxDate = new Date(now.getFullYear() + 1, 0, 1);
    return;
  }
  minDate = new Date(Math.min(...starts));
  maxDate = new Date(Math.max(...ends));
  // small visual buffer
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

  const t0 = minDate.getTime();
  const t1 = maxDate.getTime();

  // Map based on selected order
  const t = (order === "asc")
    ? t0 + prog * (t1 - t0)       // top→bottom = oldest→newest
    : t1 - prog * (t1 - t0);      // top→bottom = newest→oldest

  return new Date(t);
}

function updateRailUI(date, progress) {
  $("#cursorOut").textContent   = fmt(date);
  $("#cursorBadge").textContent = fmt(date);
  const fill = (order === "asc") ? progress : (1 - progress);
  $("#railFill").style.height = (fill * 100).toFixed(1) + "%";
}

/* ===== First-reveal centering ===== */
let centerLock = false; // prevent nested scroll loops
function centerEntryOnce(el) {
  if (!CENTER_ON_FIRST_REVEAL) return;
  if (centerLock) return;
  centerLock = true;
  // Use instant jump to avoid long smooth scroll loops; adjust if you want smooth
  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  // small async release
  setTimeout(() => { centerLock = false; }, 120);
}

/* ===== Scroll updates ===== */
function updateByDate() {
  const now = currentDateFromScroll();
  updateRailUI(now, lastProgress);

  $$("#timelineZone .entry").forEach((el) => {
    const id    = el.dataset.id;
    const start = parseDate(el.dataset.start);
    if (!start) return;

    // Reveal condition matches the chosen order
    const shouldReveal = (order === "asc") ? (now >= start) : (now <= start);

    if (shouldReveal && !revealedOnce.has(id)) {
      revealedOnce.add(id);           // mark permanently revealed
      el.classList.add("revealed");   // make visible (and stays visible forever)
      centerEntryOnce(el);            // center it the first time it appears
    } else if (revealedOnce.has(id)) {
      // Never hide again once revealed
      el.classList.add("revealed");
    } else {
      // Not yet revealed → keep hidden
      el.classList.remove("revealed");
    }
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
      <div class="badges">${(s.items || []).map((x) => `<span class="badge">${x}</span>`).join("")}</div>
    `;
    grid.appendChild(card);
    setTimeout(() => card.classList.add("show"), 80 * i);
  });
}

/* ===== Tabs ===== */
function setTab(tab) {
  const expBtn = $("#tab-experience");
  const sklBtn = $("#tab-skills");
  const exp = $("#experience");
  const skl = $("#skills");

  if (tab === "experience") {
    expBtn.classList.add("active");   expBtn.setAttribute("aria-selected", "true");
    sklBtn.classList.remove("active");sklBtn.setAttribute("aria-selected", "false");
    skl.classList.add("hidden");      exp.classList.remove("hidden");
  } else {
    sklBtn.classList.add("active");   sklBtn.setAttribute("aria-selected", "true");
    expBtn.classList.remove("active");expBtn.setAttribute("aria-selected", "false");
    exp.classList.add("hidden");      skl.classList.remove("hidden");
  }
}

/* ===== Header height → CSS var (avoid being hidden under header) ===== */
function setHeaderHeightVar() {
  const h = $("#topbar")?.offsetHeight || 0;
  document.documentElement.style.setProperty("--headerH", `${h}px`);
}

/* ===== Boot ===== */
async function boot() {
  $("#year").textContent = new Date().getFullYear();
  setHeaderHeightVar();
  window.addEventListener("resize", setHeaderHeightVar);

  try {
    const [expRes, sklRes] = await Promise.all([
      fetch(EXPERIENCE_JSON, { cache: "no-store" }),
      fetch(SKILLS_JSON, { cache: "no-store" })
    ]);
    if (!expRes.ok) throw new Error(`Failed to load ${EXPERIENCE_JSON}: ${expRes.status}`);
    if (!sklRes.ok) throw new Error(`Failed to load ${SKILLS_JSON}: ${sklRes.status}`);

    const expJson = await expRes.json();
    const sklJson = await sklRes.json();

    entries = (expJson || []).filter((e) => e && e.start);
    skills  = sklJson || [];

    computeRange();
    buildTimeline();
    renderSkills();
    updateByDate();

    window.addEventListener("scroll", updateByDate, { passive: true });
    window.addEventListener("resize", updateByDate);

    $("#orderSelect").value = order;
    $("#orderSelect").addEventListener("change", (e) => {
      order = e.target.value;
      buildTimeline();   // keep previously revealed visible
      updateByDate();    // recompute mapping for new order
    });

    $("#tab-experience").addEventListener("click", () => setTab("experience"));
    $("#tab-skills").addEventListener("click", () => setTab("skills"));
  } catch (err) {
    console.error(err);
    const zone = $("#timelineZone");
    zone.innerHTML = `
      <article class="entry revealed" style="background:#2a2f52;border:1px solid rgba(255,255,255,.2)">
        <h3>Couldn’t load your data</h3>
        <p>${String(err)}</p>
        <p style="opacity:.8">Check that <code>/data/experience.json</code> and <code>/data/skills.json</code> exist, are valid JSON, and paths match.</p>
      </article>
    `;
  }
}

document.addEventListener("DOMContentLoaded", boot);
