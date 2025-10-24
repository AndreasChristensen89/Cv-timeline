/* ===== Config ===== */
const EXPERIENCE_JSON = 'data/experience.json';
const SKILLS_JSON = 'data/skills.json';

/* ===== State ===== */
let entries = [];
let skills = [];
let order = 'desc';
let minDate = null, maxDate = null;
let revealedSet = new Set(); // entries that have already been revealed (stay visible)
let activeIds = []; // current active (ongoing) entry IDs
let lastProgress = 0;

/* ===== Scroll → Time slowness control ===== */
// Bigger number = slower time change per scroll (try 3–6)
const TIME_SLOWNESS_EXP = 4;
function slowProgress(p, k = TIME_SLOWNESS_EXP) {
  // Remap 0..1 to a curve: keeps 0→0 and 1→1 but slows in between
  return Math.pow(p, k);
}

/* ===== Helpers ===== */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const parseDate = s => (s === null || s === '') ? null : new Date(s + 'T00:00:00');
const fmt = d => d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : 'Present';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function computeRange(items) {
  const today = new Date();
  let starts = items.map(e => parseDate(e.start));
  let ends = items.map(e => parseDate(e.end) || today);
  minDate = new Date(Math.min(...starts.map(d => d.getTime())));
  maxDate = new Date(Math.max(...ends.map(d => d.getTime())));
  // add visual buffers (~ 6 months)
  minDate = new Date(minDate.getFullYear(), minDate.getMonth() - 6, 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 6, 1);
}

function currentDateFromScroll() {
  const wrap = $('#timelineWrap');
  const docH = document.documentElement.clientHeight;

  const pageY = window.scrollY + docH / 2;
  const wrapTop = wrap.offsetTop;
  const wrapBottom = wrapTop + wrap.scrollHeight - docH;

  // Linear progress 0..1 along the timeline wrapper:
  const progLinear = clamp((pageY - wrapTop) / (wrapBottom - wrapTop), 0, 1);

  // Apply slow mapping:
  const prog = slowProgress(progLinear);

  lastProgress = prog;

  const t0 = minDate.getTime(), t1 = maxDate.getTime();
  const t = t0 + prog * (t1 - t0);
  return new Date(t);
}

function byOrder(a, b) {
  return order === 'asc'
    ? (parseDate(a.start) - parseDate(b.start))
    : (parseDate(b.start) - parseDate(a.start));
}

/* ===== Create card element for an entry ===== */
function createEntryEl(e) {
  const el = document.createElement('article');
  el.className = 'entry';
  el.id = `entry-${e.id}`;

  el.innerHTML = `
    <div class="meta">${fmt(parseDate(e.start))} — ${fmt(parseDate(e.end))} · ${e.location || ''}</div>
    <h3>${e.title} · ${e.company || ''}</h3>
    <div class="desc">${e.summary || ''}</div>
    <div class="tags">${(e.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
  `;
  return el;
}

function mountExperience() {
  $('#pastZone').innerHTML = '';
  $('#activeStack').innerHTML = '';
  $('#upcomingZone').innerHTML = '';

  entries.sort(byOrder).forEach(e => {
    const el = document.getElementById(`entry-${e.id}`) || createEntryEl(e);
    if (!el.parentElement) $('#upcomingZone').appendChild(el); // start as upcoming
  });

  updateByDate();
}

function updateRailUI(date, progress) {
  $('#cursorOut').textContent = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  $('#cursorBadge').textContent = $('#cursorOut').textContent;
  $('#railFill').style.height = (progress * 100).toFixed(1) + '%';
  $('#dateCursor').style.top = `calc(${(50 + (progress - 0.5) * 10).toFixed(2)}vh)`;
}

function setLayerPositions(ids) {
  ids.forEach((id, i) => {
    const el = document.getElementById(`entry-${id}`);
    if (!el) return;
    el.style.setProperty('--offsetY', `${(ids.length - 1 - i) * -12}px`);
    el.style.zIndex = String(100 + i);
    el.classList.add('layer');
  });
}

function smoothDrop(el) {
  el.classList.add('dropping');
  setTimeout(() => {
    el.classList.remove('dropping', 'active', 'layer');
    $('#pastZone').insertBefore(el, $('#pastZone').firstChild);
  }, 360);
}

function updateByDate() {
  const now = currentDateFromScroll();
  updateRailUI(now, lastProgress);

  const nowT = now.getTime();
  const today = new Date();
  let newActiveIds = [];

  entries.forEach(e => {
    const el = document.getElementById(`entry-${e.id}`);
    const tStart = parseDate(e.start).getTime();
    const tEnd = (parseDate(e.end) || today).getTime();

    const hasStarted = nowT >= tStart;
    const isOngoing = nowT >= tStart && nowT < tEnd || e.end === null;

    if (hasStarted && !revealedSet.has(e.id)) {
      revealedSet.add(e.id);
      if (isOngoing) {
        $('#activeStack').appendChild(el);
        el.classList.add('active');
      } else {
        $('#pastZone').insertBefore(el, $('#pastZone').firstChild);
      }
      el.classList.add('revealed');
    }

    if (!hasStarted && !el.classList.contains('revealed')) {
      if (el.parentElement !== $('#upcomingZone')) $('#upcomingZone').appendChild(el);
    }

    if (el.classList.contains('revealed')) {
      if (isOngoing) {
        if (!el.classList.contains('active')) {
          $('#activeStack').appendChild(el);
          el.classList.add('active');
        }
        newActiveIds.push(e.id);
      } else {
        if (el.classList.contains('active')) {
          smoothDrop(el);
        } else if (el.parentElement !== $('#pastZone')) {
          $('#pastZone').insertBefore(el, $('#pastZone').firstChild);
        }
      }
    }
  });

  const sortFn = (a, b) => {
    const A = entries.find(x => x.id === a), B = entries.find(x => x.id === b);
    return order === 'asc'
      ? (parseDate(A.start) - parseDate(B.start))
      : (parseDate(B.start) - parseDate(A.start));
  };

  newActiveIds.sort(sortFn);
  const changed = newActiveIds.join(',') !== activeIds.join(',');
  activeIds = newActiveIds;

  if (changed) {
    activeIds.forEach(id => {
      const el = document.getElementById(`entry-${id}`);
      if (el && el.parentElement !== $('#activeStack')) $('#activeStack').appendChild(el);
      el.classList.add('active');
    });
  }
  setLayerPositions(activeIds);
}

/* ===== Skills ===== */
function renderSkills() {
  const grid = $('#skillsGrid');
  grid.innerHTML = '';
  skills.forEach((s, i) => {
    const card = document.createElement('article');
    card.className = 'skill-card';
    card.innerHTML = `
      <h4>${s.title}</h4>
      <div class="badges">
        ${(s.items || []).map(x => `<span class="badge">${x}</span>`).join('')}
      </div>
    `;
    grid.appendChild(card);
    setTimeout(() => card.classList.add('show'), 60 * i);
  });
}

/* ===== Tabs ===== */
function setTab(tab) {
  const expBtn = $('#tab-experience'), sklBtn = $('#tab-skills');
  const exp = $('#experience'), skl = $('#skills');

  if (tab === 'experience') {
    expBtn.classList.add('active'); expBtn.setAttribute('aria-selected', 'true');
    sklBtn.classList.remove('active'); sklBtn.setAttribute('aria-selected', 'false');
    skl.classList.add('hidden'); exp.classList.remove('hidden');
  } else {
    sklBtn.classList.add('active'); sklBtn.setAttribute('aria-selected', 'true');
    expBtn.classList.remove('active'); expBtn.setAttribute('aria-selected', 'false');
    exp.classList.add('hidden'); skl.classList.remove('hidden');
  }
}

/* ===== Boot ===== */
async function boot() {
  $('#year').textContent = new Date().getFullYear();

  const [expRes, skillsRes] = await Promise.all([
    fetch(EXPERIENCE_JSON), fetch(SKILLS_JSON)
  ]);
  const expJson = await expRes.json();
  const skillJson = await skillsRes.json();

  entries = expJson
    .filter(e => e.start)
    .map((e, i) => ({ id: e.id ?? (i + 1), ...e }));

  skills = skillJson;

  computeRange(entries);
  mountExperience();
  renderSkills();
  updateByDate();

  window.addEventListener('scroll', updateByDate, { passive: true });
  window.addEventListener('resize', updateByDate);

  $('#orderSelect').addEventListener('change', e => {
    order = e.target.value;
    mountExperience();
  });

  $('#tab-experience').addEventListener('click', () => setTab('experience'));
  $('#tab-skills').addEventListener('click', () => setTab('skills'));

  const skillsObserver = new IntersectionObserver((entriesObs) => {
    entriesObs.forEach(ob => {
      if (ob.isIntersecting) {
        $$('#skillsGrid .skill-card').forEach((c, i) => setTimeout(() => c.classList.add('show'), 60 * i));
        skillsObserver.disconnect();
      }
    });
  }, { threshold: .1 });
  skillsObserver.observe($('#skillsGrid'));
}

document.addEventListener('DOMContentLoaded', boot);
