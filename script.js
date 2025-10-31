/* ===== Settings ===== */
const ORDER_DEFAULT = "desc";      // "desc" = newest→oldest (scroll back in time), "asc" = oldest→newest
const ANCHOR = "end";              // "end" (recommended) or "start"
const MONTH_HEIGHT = 200;          // must match --monthH in CSS
const PIN_OFFSET = 200;            // must match --pinOffset in CSS

/* ===== Data (edit this; dates are YYYY-MM) ===== */
const ENTRIES = [
  { title:"Business Operations Manager (Prospect)", company:"Nextbike", location:"Mulhouse (Remote/Travel)", start:"2025-05", end:null, summary:"SOP rollout · MRE collaboration · e-station installs · QlikSense reporting.", tags:["Operations","SOP","Data"] },
  { title:"Test Engineer (QA)", company:"Sopra Steria (Consultant)", location:"Brussels, BE", start:"2023-09", end:"2025-03", summary:"Mobile/TV streaming QA · test automation & manual testing · Agile · ISTQB.", tags:["QA","Automation","Agile","Streaming"] },
  { title:"Full-stack Developer", company:"Omina / Claude Bernard Univ.", location:"Brussels & Lyon", start:"2021-06", end:"2022-04", summary:"Python/Django front-leaning work; product features & UI integration.", tags:["Python","Django","Frontend"] },
  { title:"Vehicle Operations → Repair Partner", company:"VOI Technology", location:"France", start:"2019-06", end:"2020-02", summary:"Ops performance, partner coordination, issue management.", tags:["Operations","Logistics","Partners"] },
  { title:"Content Manager", company:"Roskilde Office", location:"Denmark", start:"2017-01", end:"2017-11", summary:"Content ops, coordination between teams, delivery to deadlines.", tags:["Content","Coordination"] },
  { title:"Product Assistant", company:"Nordic Project (Finland/DK)", location:"Nordics", start:"2016-06", end:"2016-12", summary:"Product update project across sites; data clean-up; release support.", tags:["Products","Excel","Ops"] },
  { title:"English Teacher", company:"Japan (ALT)", location:"Japan", start:"2015-01", end:"2015-10", summary:"Classroom instruction and language coaching.", tags:["Teaching","Education"] },
  { title:"Mandarin Studies", company:"Fudan University", location:"Shanghai, CN", start:"2013-09", end:"2014-06", summary:"Intensive Chinese; HSK track.", tags:["Mandarin","HSK"] }
];

/* ===== Utils ===== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const parseMonth = s => {
  if (!s) return null;
  const [y,m] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, 1);
};
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth()+n, 1);
const monthsBetween = (a,b) => (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth());
const fmtLabel = d => d.toLocaleString(undefined, { year:"numeric", month:"short" });
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

/* ===== State ===== */
let order = ORDER_DEFAULT;
let months = []; // array of Date objects in render order
let headerH = 64;

/* ===== Build the month grid based on data span ===== */
function computeSpan() {
  const today = new Date();
  const starts = ENTRIES.map(e => parseMonth(e.start)).filter(Boolean);
  const ends   = ENTRIES.map(e => e.end ? parseMonth(e.end) : today);

  const minStart = new Date(Math.min(...starts.map(d=>d.getTime())));
  const maxEnd   = new Date(Math.max(...ends.map(d=>d.getTime())));

  const first = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
  const last  = new Date(maxEnd.getFullYear(),   maxEnd.getMonth(),   1);
  const count = monthsBetween(first, last) + 1;

  const list = [];
  for (let i=0;i<count;i++) list.push(addMonths(first, i));

  months = (order === "desc") ? list.reverse() : list;
  document.documentElement.style.setProperty("--monthH", MONTH_HEIGHT + "px");
}

/* ===== Header measurements & body padding ===== */
function setHeaderVars() {
  headerH = $("#topbar")?.offsetHeight || 64;
  document.documentElement.style.setProperty("--headerH", headerH + "px");
  document.documentElement.style.setProperty("--pinOffset", PIN_OFFSET + "px");
  // Ensure body padding matches header height so content never hides under it
  document.body.style.paddingTop = `var(--headerH)`;
}

/* ===== Render timeline months and entries ===== */
function renderTimeline() {
  const timeline = $("#timeline");
  timeline.innerHTML = "";

  // Build month rows (no labels)
  for (const d of months) {
    const row = document.createElement("div");
    row.className = "month";
    row.dataset.month = monthKey(d);
    timeline.appendChild(row);
  }

  // Place entries into anchor month rows
  for (const e of ENTRIES) {
    const anchorDate = (ANCHOR === "end")
      ? (e.end ? parseMonth(e.end) : new Date())
      : parseMonth(e.start);
    const key = monthKey(anchorDate);
    const host = timeline.querySelector(`.month[data-month="${key}"]`) || timeline.firstElementChild;

    const card = document.createElement("article");
    card.className = "entry";
    card.dataset.anchor = key;
    card.innerHTML = `
      <div class="meta">${(e.start||"")} — ${(e.end||"Present")} · ${e.location||""}</div>
      <h3>${e.title} · ${e.company||""}</h3>
      <div>${e.summary||""}</div>
      ${e.tags?.length ? `<div class="tags">${e.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>` : ""}
    `;
    host.appendChild(card);
  }
}

/* ===== Scroll behavior: pick the month row at the pin line, fix one entry ===== */
function updateOnScroll() {
  const pinY = window.scrollY + headerH + PIN_OFFSET;

  // Find the active month row at/above the pin line
  const rows = $$(".month");
  let activeRow = null;

  if (order === "desc") {
    // rows are newest→oldest down the page; choose the last row whose top <= pinY
    for (const row of rows) {
      if (row.offsetTop <= pinY) { activeRow = row; }
      else break;
    }
    if (!activeRow) activeRow = rows[0];
  } else {
    // asc: rows oldest→newest; choose the last row whose top <= pinY
    for (const row of rows) {
      if (row.offsetTop <= pinY) { activeRow = row; }
      else break;
    }
    if (!activeRow) activeRow = rows[0];
  }

  // Update header date badge
  const [yy,mm] = activeRow.dataset.month.split("-").map(Number);
  $("#cursorOut").textContent = fmtLabel(new Date(yy, mm-1, 1));

  // Fix exactly one entry from the active row (most representative)
  // For desc: choose the last card in that month; for asc: choose the first.
  const cards = activeRow.querySelectorAll(".entry");
  let chosen = null;
  if (cards.length) {
    chosen = (order === "desc") ? cards[cards.length - 1] : cards[0];
  }

  // Clear previous fixed card, set new one
  $$(".entry.fixed").forEach(el => el.classList.remove("fixed"));
  if (chosen) chosen.classList.add("fixed");
}

/* ===== Tabs & Skills (simple toggle) ===== */
function setTab(tab) {
  const exp = $("#experience"), skl = $("#skills");
  const bExp = $("#tab-experience"), bSkl = $("#tab-skills");
  if (tab === "experience") {
    exp.classList.remove("hidden"); skl.classList.add("hidden");
    bExp.classList.add("active"); bSkl.classList.remove("active");
  } else {
    skl.classList.remove("hidden"); exp.classList.add("hidden");
    bSkl.classList.add("active"); bExp.classList.remove("active");
  }
}
function renderSkills() {
  const SKILLS = [
    { title:"Languages", items:["English (C2)","French (B2)","Mandarin (HSK3–4)","Danish (Native)"] },
    { title:"Ops & QA",  items:["SOPs","Issue Mgmt","ISTQB","Agile","Test Automation"] },
    { title:"Tech",      items:["Python","Django","HTML/CSS/JS","Git"] }
  ];
  const grid = $("#skillsGrid"); grid.innerHTML = "";
  SKILLS.forEach(s=>{
    const card = document.createElement("div");
    card.className="skill-card";
    card.innerHTML = `<h4>${s.title}</h4><div class="badges">${s.items.map(x=>`<span class="badge">${x}</span>`).join("")}</div>`;
    grid.appendChild(card);
  });
}

/* ===== Boot ===== */
function boot(){
  $("#year").textContent = new Date().getFullYear();
  setHeaderVars();

  computeSpan();
  renderTimeline();
  renderSkills();

  updateOnScroll();
  window.addEventListener("scroll", updateOnScroll, {passive:true});
  window.addEventListener("resize", () => { setHeaderVars(); updateOnScroll(); });

  // Order switch: rebuild months & entries in the other direction
  $("#orderSelect").value = ORDER_DEFAULT;
  $("#orderSelect").addEventListener("change", e => {
    order = e.target.value;
    computeSpan();
    renderTimeline();
    updateOnScroll();
  });

  $("#tab-experience").addEventListener("click", () => setTab("experience"));
  $("#tab-skills").addEventListener("click",     () => setTab("skills"));
}

document.addEventListener("DOMContentLoaded", boot);
