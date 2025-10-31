/* ===== Tiny, robust timeline ===== */

/* CONFIG */
const ORDER_DEFAULT = "desc";      // "desc" = newest→oldest (scroll back in time)
const ANCHOR = "end";              // "end" (recommended) or "start"
const MONTH_HEIGHT = 200;          // px per month (set in CSS too via --monthH)
const PIN_OFFSET = 200;            // px under header to pin fixed entry

/* DATA: add/adjust your entries here */
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

/* ===== Utilities ===== */
const $ = s => document.querySelector(s);
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const parseMonth = s => {
  if (!s) return null;
  const [y,m] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, 1);
};
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth()+n, 1);
const monthsBetween = (a,b) => {
  const y = b.getFullYear() - a.getFullYear();
  const m = b.getMonth() - a.getMonth();
  return y*12 + m;
};
const fmtLabel = d => d.toLocaleString(undefined, { year:"numeric", month:"short" });

/* ===== Build months + entries ===== */
let order = ORDER_DEFAULT;
let months = []; // array of Date objects, newest→oldest for "desc"
let headerH = 64;

function computeSpan() {
  const today = new Date();
  const starts = ENTRIES.map(e => parseMonth(e.start)).filter(Boolean);
  const ends = ENTRIES.map(e => e.end ? parseMonth(e.end) : today);

  const minStart = new Date(Math.min(...starts.map(d=>d.getTime())));
  const maxEnd   = new Date(Math.max(...ends.map(d=>d.getTime())));

  // Build month list inclusive between minStart..maxEnd
  const first = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
  const last  = new Date(maxEnd.getFullYear(),   maxEnd.getMonth(),   1);
  const count = monthsBetween(first, last) + 1;

  const list = [];
  for (let i=0;i<count;i++) list.push(addMonths(first, i));

  months = (order === "desc") ? list.reverse() : list; // newest→oldest or oldest→newest

  // set heights
  document.documentElement.style.setProperty("--monthH", MONTH_HEIGHT+"px");
}

function setHeaderVars() {
  headerH = $("#topbar")?.offsetHeight || 64;
  document.documentElement.style.setProperty("--headerH", headerH+"px");
  document.documentElement.style.setProperty("--pinOffset", PIN_OFFSET+"px");
}

function renderTimeline() {
  const timeline = $("#timeline");
  timeline.innerHTML = "";

  for (const d of months) {
    const row = document.createElement("div");
    row.className = "month";
    row.dataset.month = monthKey(d);

    const label = document.createElement("div");
    label.className = "month-label";
    label.textContent = fmtLabel(d);

    row.appendChild(label);
    timeline.appendChild(row);
  }

  // Place entries into anchor month rows
  for (const e of ENTRIES) {
    const anchorDate = ANCHOR === "end" ? (e.end ? parseMonth(e.end) : new Date()) : parseMonth(e.start);
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

  // Months container height is implicit: N * 200px via CSS
}

/* ===== Scroll logic (super small): one fixed card at a time ===== */
function updateCursorAndFix() {
  const y = window.scrollY + headerH + PIN_OFFSET;

  // Determine which month is currently at/above the pin line
  const monthRows = Array.from(document.querySelectorAll(".month"));
  let activeRow = null;
  for (const row of monthRows) {
    const top = row.offsetTop;
    if (top <= y) { activeRow = row; break; } // rows are ordered newest→oldest for "desc"
  }
  if (!activeRow) activeRow = monthRows[0];

  // Update date badge
  const d = activeRow.dataset.month.split("-"); // YYYY-MM
  const labelDate = new Date(Number(d[0]), Number(d[1])-1, 1);
  $("#cursorOut").textContent = fmtLabel(labelDate);

  // Fix exactly one entry: the last entry inside the active row (most recent within that month)
  document.querySelectorAll(".entry.fixed").forEach(el => el.classList.remove("fixed"));
  const entriesInRow = activeRow.querySelectorAll(".entry");
  if (entriesInRow.length) {
    // pick last for "desc", first for "asc"
    const chosen = (order === "desc") ? entriesInRow[entriesInRow.length-1] : entriesInRow[0];
    chosen.classList.add("fixed");
  }
}

/* ===== Tabs: toggle sections only ===== */
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

/* ===== Simple skills (static demo, edit as you like) ===== */
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

  updateCursorAndFix();
  window.addEventListener("scroll", updateCursorAndFix, {passive:true});
  window.addEventListener("resize", ()=>{ setHeaderVars(); updateCursorAndFix(); });

  // Order toggle simply reverses the month list and rerenders
  $("#orderSelect").value = ORDER_DEFAULT;
  $("#orderSelect").addEventListener("change", e=>{
    order = e.target.value;
    computeSpan();
    renderTimeline();
    updateCursorAndFix();
  });

  $("#tab-experience").addEventListener("click", ()=> setTab("experience"));
  $("#tab-skills").addEventListener("click",     ()=> setTab("skills"));
}

document.addEventListener("DOMContentLoaded", boot);
