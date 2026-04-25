// STATE
const state = {
  dayKeys: ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'],
  dayLabels: {
    day1: 'lower â€” squat',
    day2: 'upper â€” push/pull',
    day3: 'rest',
    day4: 'lower â€” hinge',
    day5: 'upper â€” vertical + arms',
    day6: 'rest',
    day7: 'rest'
  },
  restDays: new Set(['day3', 'day6', 'day7']),
  currentDay: 'day1',
  currentExIdx: 0,
  today: new Date().toISOString().split('T')[0],
  sessionData: {},
  programmeData: {},
  adaptSuggestions: [],
  activeView: 'today'
};

// API
const api = {
  async getCurrentDay() {
    const res = await fetch('/api/current_day');
    return res.json();
  },

  async getProgramme(dayKey) {
    const res = await fetch(`/api/programme/${dayKey}`);
    return res.json();
  },

  async getSession(dayKey, date) {
    const res = await fetch(`/api/session/${dayKey}?date=${date}`);
    return res.json();
  },

  async saveSet(payload) {
    const res = await fetch('/api/session/set', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    return res.json().catch(() => ({}));
  },

  async completeSession(payload) {
    const res = await fetch('/api/session/complete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async acceptAdapt(payload) {
    const res = await fetch('/api/adapt/accept', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    return res.json().catch(() => ({}));
  },

  async getHistory() {
    const res = await fetch('/api/history');
    return res.json();
  },

  async updateProgramme(id, payload) {
    const res = await fetch(`/api/programme/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    return res.json().catch(() => ({}));
  }
};

// UI
function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function renderHeaderDate(date) {
  qs('#header-date').textContent = date;
}

function showToast(msg) {
  const toast = qs('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function setActiveView(name) {
  qsa('.view').forEach(view => view.classList.remove('active'));
  qsa('.tab').forEach(tab => tab.classList.remove('active'));
  qs(`#view-${name}`).classList.add('active');
  qsa('.tab').forEach(tab => {
    if (tab.dataset.view === name) tab.classList.add('active');
  });
}

function buildDayStrip(dayKeys, dayLabels, restDays, currentDay) {
  const buttons = dayKeys.map(key => {
    const rest = restDays.has(key) ? ' rest' : '';
    const active = key === currentDay ? ' active' : '';
    return `<button class="day-pill${active}${rest}" data-day="${key}">${key.replace('day', 'd')} ${dayLabels[key]}</button>`;
  }).join('');
  return `<div class="day-strip">${buttons}</div>`;
}

function renderRestDay(container, dayStrip) {
  container.innerHTML = dayStrip + `<div class="rest-card"><div class="rest-icon">ðŸŒ™</div><div class="rest-label">rest day</div><div class="rest-sub">recovery is part of the programme</div></div>`;
}

function buildAdaptBanners(suggestions) {
  return suggestions.map((suggestion, index) => `
    <div class="adapt-banner">
      <div><div class="adapt-text">${suggestion.exercise}</div><div class="adapt-sub">beat target â€” try ${suggestion.suggested_weight}kg next week</div></div>
      <div class="adapt-actions">
        <button class="adapt-accept" data-adapt-index="${index}">accept</button>
        <button class="adapt-dismiss" data-adapt-index="${index}">dismiss</button>
      </div>
    </div>`).join('');
}

function getSetKey(exercise, setNum) {
  return `${exercise}__${setNum}`;
}

function getDoneSetCount(session) {
  return Object.values(session || {}).filter(set => set.done).length;
}

function getTotalSetCount(programme) {
  return programme.reduce((total, exercise) => total + exercise.sets, 0);
}

function buildExerciseMeta(exercise) {
  const note = [exercise.unit, exercise.note].filter(Boolean).join(' Â· ');
  return `${exercise.sets} sets${exercise.reps ? ' Ã— ' + exercise.reps + ' reps' : ''}${exercise.weight ? ' Â· ' + exercise.weight + (exercise.unit || 'kg') : ''}${note ? ' Â· ' + note : ''}`;
}

function buildSetRows(exercise, session) {
  let rows = '';
  for (let setNum = 1; setNum <= exercise.sets; setNum++) {
    const key = getSetKey(exercise.exercise, setNum);
    const logged = session[key] || {};
    const repsVal = logged.reps ?? exercise.reps ?? '';
    const weightVal = logged.weight ?? exercise.weight ?? '';
    const done = logged.done ? true : false;
    rows += `<div class="set-row">
      <div class="set-num">${setNum}</div>
      <div class="set-field">
        <div class="set-label">reps</div>
        <input class="set-input${done ? ' confirmed' : ''}" type="number" inputmode="decimal"
          value="${repsVal}" placeholder="â€”"
          data-ex="${exercise.exercise}" data-set="${setNum}" data-field="reps">
      </div>
      <div class="set-field">
        <div class="set-label">kg</div>
        <input class="set-input${done ? ' confirmed' : ''}" type="number" inputmode="decimal"
          value="${weightVal}" placeholder="BW"
          data-ex="${exercise.exercise}" data-set="${setNum}" data-field="weight">
      </div>
      <button class="check-btn${done ? ' done' : ''}" data-ex="${exercise.exercise}" data-set="${setNum}"></button>
    </div>`;
  }
  return rows;
}

function buildExerciseCards(programme, session, currentExIdx) {
  const cards = programme.map((exercise, index) => `
    <div class="ex-card${index === currentExIdx ? ' active' : ''}" id="ex-card-${index}">
      <div class="ex-name">${exercise.exercise}</div>
      <div class="ex-meta">${buildExerciseMeta(exercise)}</div>
      <div class="sets-list">${buildSetRows(exercise, session)}</div>
    </div>`).join('');
  return `<div class="ex-card-wrap">${cards}</div>`;
}

function isExerciseDone(exercise, session) {
  return Array.from({length: exercise.sets}, (_, index) => getSetKey(exercise.exercise, index + 1))
    .every(key => session[key]?.done);
}

function buildExerciseDots(programme, session, currentExIdx) {
  const dots = programme.map((exercise, index) => {
    const active = index === currentExIdx ? ' active' : '';
    const done = isExerciseDone(exercise, session) ? ' done' : '';
    return `<div class="ex-dot${active}${done}" data-ex-index="${index}"></div>`;
  }).join('');
  return `<div class="ex-dots">${dots}</div>`;
}

function buildExerciseNav(programme, currentExIdx) {
  return `<div class="ex-nav">
    <button class="nav-btn" id="btn-prev" data-nav-offset="-1" ${currentExIdx === 0 ? 'disabled' : ''}>â† prev</button>
    <button class="nav-btn next" id="btn-next" data-nav-offset="1" ${currentExIdx === programme.length - 1 ? 'disabled' : ''}>next â†’</button>
  </div>`;
}

function buildSessionHeader(dayLabel, programme, session, currentExIdx) {
  const totalSets = getTotalSetCount(programme);
  const doneSets = getDoneSetCount(session);
  const pct = totalSets > 0 ? (doneSets / totalSets * 100).toFixed(0) : 0;
  return `<div class="session-header">
    <div class="session-title">${dayLabel}</div>
    <div class="session-meta">
      <span class="ex-counter">${currentExIdx + 1}/${programme.length} exercises</span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="ex-counter">${doneSets}/${totalSets} sets</span>
    </div>
  </div>`;
}

function renderToday({dayKeys, dayLabels, restDays, currentDay, currentExIdx, programme, session, adaptSuggestions}) {
  const container = qs('#view-today');
  const dayStrip = buildDayStrip(dayKeys, dayLabels, restDays, currentDay);

  if (restDays.has(currentDay)) {
    renderRestDay(container, dayStrip);
    return;
  }

  const banners = buildAdaptBanners(adaptSuggestions);
  const header = buildSessionHeader(dayLabels[currentDay], programme, session, currentExIdx);
  const cards = buildExerciseCards(programme, session, currentExIdx);
  const dots = buildExerciseDots(programme, session, currentExIdx);
  const nav = buildExerciseNav(programme, currentExIdx);

  container.innerHTML = dayStrip + banners + header + cards + dots + nav + `<div class="complete-wrap"></div>`;
  renderCompletionControl(programme, session, currentExIdx);
}

function renderExCard(currentExIdx, programme) {
  qsa('.ex-card').forEach((card, index) => {
    card.classList.toggle('active', index === currentExIdx);
  });
  const counter = qs('.ex-counter');
  if (counter) counter.textContent = `${currentExIdx + 1}/${programme.length} exercises`;
}

function renderDots(currentExIdx) {
  qsa('.ex-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index === currentExIdx);
  });
}

function renderNav(programme, currentExIdx) {
  const buttons = qsa('.nav-btn');
  if (buttons[0]) buttons[0].disabled = currentExIdx === 0;
  if (buttons[1]) buttons[1].disabled = currentExIdx === programme.length - 1;
}

function renderCompletionControl(programme, session, currentExIdx) {
  const wrap = qs('.complete-wrap');
  if (!wrap) return;
  const doneSets = getDoneSetCount(session);
  wrap.innerHTML = currentExIdx === programme.length - 1
    ? `<button class="complete-btn" ${doneSets === 0 ? 'disabled' : ''}>complete session â†’ obsidian</button>`
    : '';
}

function renderProgress(programme, session) {
  const totalSets = getTotalSetCount(programme);
  const doneSets = getDoneSetCount(session);
  const pct = (doneSets / totalSets * 100).toFixed(0);
  const fill = qs('.progress-fill');
  const completeBtn = qs('.complete-btn');
  const counters = qsa('.ex-counter');
  if (fill) fill.style.width = pct + '%';
  if (completeBtn) completeBtn.disabled = doneSets === 0;
  if (counters[1]) counters[1].textContent = `${doneSets}/${totalSets} sets`;
}

function renderExerciseDoneDot(exercise, session, exIdx) {
  const dot = qsa('.ex-dot')[exIdx];
  if (dot) dot.classList.toggle('done', isExerciseDone(exercise, session));
}

function renderProgramme(programmes, dayKeys, dayLabels, restDays) {
  const container = qs('#view-programme');
  let html = '';
  dayKeys.forEach(key => {
    if (restDays.has(key)) return;
    html += `<div class="prog-day">
      <div class="prog-day-label">${dayLabels[key]}</div>
      <table class="prog-table">
        <thead><tr><th>exercise</th><th>sets</th><th>reps</th><th>weight</th></tr></thead>
        <tbody>`;
    programmes[key].forEach(exercise => {
      html += `<tr>
        <td>${exercise.exercise}</td>
        <td><input class="prog-input" type="number" value="${exercise.sets}" data-prog-id="${exercise.id}" data-field="sets"></td>
        <td><input class="prog-input" type="number" value="${exercise.reps || ''}" placeholder="â€”" data-prog-id="${exercise.id}" data-field="reps"></td>
        <td><input class="prog-input" type="number" value="${exercise.weight || ''}" placeholder="BW" data-prog-id="${exercise.id}" data-field="weight"></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  });
  container.innerHTML = html;
}

function renderHistory(history, dayLabels) {
  const container = qs('#view-history');
  if (!history.length) {
    container.innerHTML = `<div class="history-empty">no sessions logged yet</div>`;
    return;
  }
  container.innerHTML = history.map(item => `
    <div class="history-item">
      <div>
        <div class="history-date">${item.date}</div>
        <div class="history-label">${dayLabels[item.day_key] || item.day_key}</div>
      </div>
    </div>`).join('');
}

function renderSummary(nextDayKey, currentDay, today, dayLabels, programme, session) {
  const container = qs('#view-today');
  const strip = qs('.day-strip', container)?.outerHTML || '';
  const summary = buildSummary(nextDayKey, currentDay, today, dayLabels, programme, session);
  container.innerHTML = strip + summary;
}

function buildSummary(nextDayKey, currentDay, today, dayLabels, programme, session) {
  const details = buildSummaryDetails(programme, session);
  const nextLabel = dayLabels[nextDayKey] || nextDayKey;
  return `<div class="summary-card">
    <div class="summary-header">
      <div class="summary-tick-big">âœ“</div>
      <div class="summary-title">session complete</div>
      <div class="summary-date">${today} Â· ${dayLabels[currentDay]}</div>
    </div>
    <div class="summary-volume">
      <span class="summary-volume-num">${Math.round(details.totalVolume).toLocaleString()}</span>
      <span class="summary-volume-label">kg total volume</span>
    </div>
    <div class="summary-exercises">${details.exerciseRows}</div>
    <div class="summary-next">next up â€” ${nextLabel}</div>
  </div>`;
}

function buildSummaryDetails(programme, session) {
  let totalVolume = 0;
  let exerciseRows = '';
  programme.forEach(exercise => {
    exerciseRows += `<div class="summary-ex"><div class="summary-ex-name">${exercise.exercise}</div>`;
    for (let setNum = 1; setNum <= exercise.sets; setNum++) {
      const key = getSetKey(exercise.exercise, setNum);
      const logged = session[key] || {};
      const reps = logged.reps || exercise.reps || 'â€”';
      const weight = logged.weight || exercise.weight || 0;
      const done = logged.done;
      if (done && reps !== 'â€”' && weight) totalVolume += parseFloat(reps) * parseFloat(weight);
      exerciseRows += `<div class="summary-set${done ? ' done' : ''}">
        set ${setNum} â€” ${reps} reps Ã— ${weight || 'BW'}kg
        ${done ? '<span class="summary-tick">âœ“</span>' : ''}
      </div>`;
    }
    exerciseRows += `</div>`;
  });
  return {totalVolume, exerciseRows};
}

// INTERACTIONS
function getCurrentProgramme() {
  return state.programmeData[state.currentDay] || [];
}

function getCurrentSession() {
  if (!state.sessionData[state.currentDay]) state.sessionData[state.currentDay] = {};
  return state.sessionData[state.currentDay];
}

function normalizeSession(sessionRows) {
  const session = {};
  sessionRows.forEach(row => {
    session[getSetKey(row.exercise, row.set_num)] = row;
  });
  return session;
}

function getTodayRenderData() {
  return {
    dayKeys: state.dayKeys,
    dayLabels: state.dayLabels,
    restDays: state.restDays,
    currentDay: state.currentDay,
    currentExIdx: state.currentExIdx,
    programme: getCurrentProgramme(),
    session: getCurrentSession(),
    adaptSuggestions: state.adaptSuggestions
  };
}

async function loadDay(dayKey) {
  state.currentDay = dayKey;
  state.currentExIdx = 0;
  const [programme, sessionRows] = await Promise.all([
    api.getProgramme(dayKey),
    api.getSession(dayKey, state.today)
  ]);
  state.programmeData[dayKey] = programme;
  state.sessionData[dayKey] = normalizeSession(sessionRows);
  state.adaptSuggestions = [];
}

async function selectDay(dayKey) {
  await loadDay(dayKey);
  renderToday(getTodayRenderData());
}

function goToEx(index) {
  state.currentExIdx = index;
  const programme = getCurrentProgramme();
  const session = getCurrentSession();
  renderExCard(state.currentExIdx, programme);
  renderDots(state.currentExIdx);
  renderNav(programme, state.currentExIdx);
  renderCompletionControl(programme, session, state.currentExIdx);
}

async function showView(name) {
  state.activeView = name;
  setActiveView(name);
  if (name === 'today') renderToday(getTodayRenderData());
  if (name === 'programme') await showProgrammeView();
  if (name === 'history') await showHistoryView();
}

async function showProgrammeView() {
  const programmes = {};
  await Promise.all(state.dayKeys.map(async dayKey => {
    if (!state.restDays.has(dayKey)) programmes[dayKey] = await api.getProgramme(dayKey);
  }));
  renderProgramme(programmes, state.dayKeys, state.dayLabels, state.restDays);
}

async function showHistoryView() {
  const history = await api.getHistory();
  renderHistory(history, state.dayLabels);
}

function updateSetState(exercise, setNum, field, value) {
  const session = getCurrentSession();
  const key = getSetKey(exercise, setNum);
  if (!session[key]) session[key] = {};
  session[key][field] = value;
  return session[key];
}

function buildSaveSetPayload(exercise, setNum, logged) {
  return {
    date: state.today,
    day_key: state.currentDay,
    exercise,
    set_num: setNum,
    reps: logged.reps ?? null,
    weight: logged.weight ?? null,
    done: logged.done ? 1 : 0
  };
}

async function logSet(exercise, setNum, field, value) {
  const logged = updateSetState(exercise, setNum, field, value);
  await api.saveSet(buildSaveSetPayload(exercise, setNum, logged));
}

function getExerciseIndex(exerciseName) {
  return getCurrentProgramme().findIndex(exercise => exercise.exercise === exerciseName);
}

function getSetInputs(exercise, setNum) {
  return {
    repsInput: findSetInput(exercise, setNum, 'reps'),
    weightInput: findSetInput(exercise, setNum, 'weight')
  };
}

function findSetInput(exercise, setNum, field) {
  return qsa('.set-input').find(input =>
    input.dataset.ex === exercise &&
    Number(input.dataset.set) === setNum &&
    input.dataset.field === field
  );
}

function updateSetControls(button, repsInput, weightInput, done) {
  button.classList.toggle('done', done);
  if (repsInput) repsInput.classList.toggle('confirmed', done);
  if (weightInput) weightInput.classList.toggle('confirmed', done);
}

function updateSetCompletion(exercise, setNum, exIdx, button) {
  const session = getCurrentSession();
  const key = getSetKey(exercise, setNum);
  if (!session[key]) session[key] = {};

  const nowDone = !session[key].done;
  const programmeExercise = getCurrentProgramme()[exIdx];
  const {repsInput, weightInput} = getSetInputs(exercise, setNum);
  const reps = repsInput?.value || programmeExercise.reps || null;
  const weight = weightInput?.value || programmeExercise.weight || null;

  session[key].done = nowDone;
  session[key].reps = reps;
  session[key].weight = weight;
  updateSetControls(button, repsInput, weightInput, nowDone);

  return {reps, weight, done: nowDone};
}

async function toggleSet(exercise, setNum, button) {
  const exIdx = getExerciseIndex(exercise);
  const updated = updateSetCompletion(exercise, setNum, exIdx, button);
  await api.saveSet({
    date: state.today,
    day_key: state.currentDay,
    exercise,
    set_num: setNum,
    reps: updated.reps,
    weight: updated.weight,
    done: updated.done ? 1 : 0
  });
  const programme = getCurrentProgramme();
  const session = getCurrentSession();
  renderProgress(programme, session);
  renderExerciseDoneDot(programme[exIdx], session, exIdx);
}

function buildCompletionSaves() {
  const saves = [];
  getCurrentProgramme().forEach(exercise => {
    for (let setNum = 1; setNum <= exercise.sets; setNum++) {
      const session = getCurrentSession();
      const key = getSetKey(exercise.exercise, setNum);
      const logged = session[key] || {};
      const {repsInput, weightInput} = getSetInputs(exercise.exercise, setNum);
      saves.push(api.saveSet({
        date: state.today,
        day_key: state.currentDay,
        exercise: exercise.exercise,
        set_num: setNum,
        reps: repsInput?.value || exercise.reps || null,
        weight: weightInput?.value || exercise.weight || null,
        done: logged.done ? 1 : 0
      }));
    }
  });
  return saves;
}

async function completeSession() {
  await Promise.all(buildCompletionSaves());
  const data = await api.completeSession({date: state.today, day_key: state.currentDay});
  const nextData = await api.getCurrentDay();
  showToast(data.ok ? 'âœ“ saved to obsidian' : 'saved locally');
  renderSummary(nextData.day_key, state.currentDay, state.today, state.dayLabels, getCurrentProgramme(), getCurrentSession());
}

async function acceptAdapt(index) {
  const suggestion = state.adaptSuggestions[index];
  await api.acceptAdapt({programme_id: suggestion.programme_id, new_weight: suggestion.suggested_weight});
  state.programmeData[state.currentDay] = await api.getProgramme(state.currentDay);
  state.adaptSuggestions.splice(index, 1);
  showToast(`updated: ${suggestion.exercise} â†’ ${suggestion.suggested_weight}kg`);
  renderToday(getTodayRenderData());
}

function dismissAdapt(index) {
  state.adaptSuggestions.splice(index, 1);
  renderToday(getTodayRenderData());
}

async function updateProgramme(id, field, value) {
  await api.updateProgramme(id, {[field]: parseFloat(value)});
}

function handleTabClick(event) {
  const tab = event.target.closest('.tab');
  if (tab) showView(tab.dataset.view);
}

function handleTodayClick(event) {
  const dayButton = event.target.closest('.day-pill');
  const dot = event.target.closest('.ex-dot');
  const navButton = event.target.closest('.nav-btn');
  const checkButton = event.target.closest('.check-btn');
  const completeButton = event.target.closest('.complete-btn');
  const acceptButton = event.target.closest('.adapt-accept');
  const dismissButton = event.target.closest('.adapt-dismiss');

  if (dayButton) selectDay(dayButton.dataset.day);
  if (dot) goToEx(Number(dot.dataset.exIndex));
  if (navButton) goToEx(state.currentExIdx + Number(navButton.dataset.navOffset));
  if (checkButton) toggleSet(checkButton.dataset.ex, Number(checkButton.dataset.set), checkButton);
  if (completeButton) completeSession();
  if (acceptButton) acceptAdapt(Number(acceptButton.dataset.adaptIndex));
  if (dismissButton) dismissAdapt(Number(dismissButton.dataset.adaptIndex));
}

function handleSetInput(event) {
  const input = event.target.closest('.set-input');
  if (!input) return;
  logSet(input.dataset.ex, Number(input.dataset.set), input.dataset.field, input.value);
}

function handleProgrammeChange(event) {
  const input = event.target.closest('.prog-input');
  if (!input) return;
  updateProgramme(input.dataset.progId, input.dataset.field, input.value);
}

function bindInteractions() {
  qs('.tabs').addEventListener('click', handleTabClick);
  qs('#view-today').addEventListener('click', handleTodayClick);
  qs('#view-today').addEventListener('input', handleSetInput);
  qs('#view-programme').addEventListener('change', handleProgrammeChange);
}

async function init() {
  renderHeaderDate(state.today);
  bindInteractions();
  const currentDay = await api.getCurrentDay();
  await selectDay(currentDay.day_key);
}

document.addEventListener('DOMContentLoaded', init);
