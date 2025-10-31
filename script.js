/* Minimal rendering: read JSON, render cards top-to-bottom. No timeline logic. */

/* Paths (keep your JSON files here) */
const EXPERIENCE_JSON = "data/experience.json";
const SKILLS_JSON     = "data/skills.json";

/* Sort settings:
   - ORDER_DEFAULT: "desc" = newest→oldest, "asc" = oldest→newest
   - DATE_ANCHOR: choose which date to sort by: "end" (default) or "start"
*/
const ORDER_DEFAULT = "desc";
const DATE_ANCHOR   = "end";

/* Helpers */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const parseMonth = (s) => {
  if (!s) return null;
  const [y,m] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, 1);
};
const fmt = (d) => d ? d.toLocaleDateString(undefined, { year:"numeric", month:"short" }) : "Present";
const getSortDate = (e) => {
  // If anchoring by end and end is null ("Present"), treat as very new
  if (DATE_ANCHOR === "end") {
    return e.end ? parseMonth(e.end) : new Date(9999,0,1);
  }
  // Otherwise start date
  return parseMonth(e.start) || new Date(0);
};
function byOrder(a, b, order) {
  const A = getSortDate(a)?.getTime() ?? 0;
  const B = getSortDate(b)?.getTime() ?? 0;
  return order === "asc" ? (A - B) : (B - A);
}

/* Renderers */
function renderExperience(list, order) {
  const wrap = $("#experienceList");
  wrap.innerHTML = "";
  const sorted = [...list].sort((a,b)=>byOrder(a,b,order));

  sorted.forEach((e) => {
    const card = document.createElement("article");
    card.className = "entry";
    const start = parseMonth(e.start);
    const end   = e.end ? parseMonth(e.end) : null;

    card.innerHTML = `
      <div class="meta">${fmt(start)} — ${fmt(end)} · ${e.location || ""}</div>
      <h3>${e.title} · ${e.company || ""}</h3>
      <div>${e.summary || ""}</div>
      ${Array.isArray(e.tags) && e.tags.length
        ? `<div class="tags">${e.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>`
        : ""}
    `;
    wrap.appendChild(card);
  });

  if (!sorted.length) {
    wrap.innerHTML = `
      <article class="entry">
        <h3>No experience entries</h3>
        <p>Make sure <code>data/experience.json</code> exists and contains an array of objects.</p>
      </article>
    `;
  }
}

function renderSkills(list) {
  const grid = $("#skillsGrid");
  grid.innerHTML = "";
  (list || []).forEach((s) => {
    const card = document.createElement("div");
    card.className = "skill-card";
    card.innerHTML = `
      <h4>${s.title || ""}</h4>
      <div class="badges">
        ${(s.items || []).map(x=>`<span class="badge">${x}</span>`).join("")}
      </div>
    `;
    grid.appendChild(card);
  });
}

/* Tabs */
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

/* Boot */
async function boot(){
  $("#year").textContent = new Date().getFullYear();

  try {
    const [expRes, sklRes] = await Promise.all([
      fetch(EXPERIENCE_JSON, { cache:"no-store" }),
      fetch(SKILLS_JSON,     { cache:"no-store" })
    ]);
    if (!expRes.ok) throw new Error(`Failed to load ${EXPERIENCE_JSON}: ${expRes.status}`);
    if (!sklRes.ok) throw new Error(`Failed to load ${SKILLS_JSON}: ${sklRes.status}`);

    const exp = await expRes.json();
    const skl = await sklRes.json();

    // initial render
    $("#orderSelect").value = ORDER_DEFAULT;
    renderExperience(exp, ORDER_DEFAULT);
    renderSkills(skl);

    // handlers
    $("#orderSelect").addEventListener("change", e => {
      renderExperience(exp, e.target.value);
    });
    $("#tab-experience").addEventListener("click", () => setTab("experience"));
    $("#tab-skills").addEventListener("click", () => setTab("skills"));
  } catch (err) {
    console.error(err);
    $("#experienceList").innerHTML = `
      <article class="entry">
        <h3>Couldn’t load data</h3>
        <p>${String(err)}</p>
        <p>Check that <code>data/experience.json</code> and <code>data/skills.json</code> exist and contain valid JSON.</p>
      </article>
    `;
  }
}

document.addEventListener("DOMContentLoaded", boot);
