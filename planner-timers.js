(() => {
  if (window.__plannerTimersLoaded) return;
  window.__plannerTimersLoaded = true;

  const TIMER_KEY = 'calendar-round-timers-v1';
  const PLANNER_KEY = 'focus-week-planner-v2';
  let tick = null;

  function readTimers() {
    try { return JSON.parse(localStorage.getItem(TIMER_KEY)) || []; }
    catch { return []; }
  }
  function saveTimers(timers) {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timers));
  }
  function readPlanner() {
    try { return JSON.parse(localStorage.getItem(PLANNER_KEY)) || { tasks: [], weeks: {} }; }
    catch { return { tasks: [], weeks: {} }; }
  }
  function makeId() {
    return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function pad(value) { return String(value).padStart(2, '0'); }
  function fmt(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
  }
  function taskTitle(planner, instance) {
    if (instance.title) return instance.title;
    const task = planner.tasks?.find(item => item.id === instance.taskId);
    return task ? `${task.name}${instance.sequence ? ` ${instance.sequence}/${task.frequency || 1}` : ''}` : 'Planned task';
  }
  function scheduledTasks() {
    const planner = readPlanner();
    const out = [];
    Object.values(planner.weeks || {}).forEach(week => {
      (week.instances || []).forEach(instance => {
        if (!instance.scheduledAt || instance.deleted || instance.status === 'skipped') return;
        out.push({ id: instance.id, title: taskTitle(planner, instance), duration: Number(instance.duration || 25), when: instance.scheduledAt });
      });
    });
    return out.sort((a, b) => new Date(a.when) - new Date(b.when));
  }

  function ensurePanel() {
    const panel = document.querySelector('.mock-timer-panel');
    if (!panel || panel.dataset.roundTimersReady) return panel;
    panel.dataset.roundTimersReady = 'true';
    panel.innerHTML = `
      <div class="timer-top">
        <h2>Timers</h2>
        <p class="timer-help">Round task timers. Add as many as you need.</p>
      </div>
      <form id="roundTimerForm" class="round-timer-form">
        <label>Task
          <select id="roundTimerTask"></select>
        </label>
        <label>Minutes
          <input id="roundTimerMinutes" type="number" min="1" max="240" step="1" value="25">
        </label>
        <button type="submit">Add timer</button>
      </form>
      <div id="roundTimers" class="round-timer-list"></div>
    `;
    panel.querySelector('#roundTimerForm').addEventListener('submit', event => {
      event.preventDefault();
      addTimer();
    });
    return panel;
  }

  function renderTaskOptions() {
    const select = document.getElementById('roundTimerTask');
    if (!select) return;
    const selected = select.value;
    const tasks = scheduledTasks();
    select.innerHTML = '';
    if (!tasks.length) {
      const opt = document.createElement('option');
      opt.value = 'custom';
      opt.textContent = 'No calendar tasks yet — custom timer';
      opt.dataset.duration = '25';
      select.appendChild(opt);
    } else {
      tasks.forEach(task => {
        const opt = document.createElement('option');
        opt.value = task.id;
        opt.textContent = task.title;
        opt.dataset.duration = String(task.duration || 25);
        select.appendChild(opt);
      });
      const custom = document.createElement('option');
      custom.value = 'custom';
      custom.textContent = 'Custom timer';
      custom.dataset.duration = '25';
      select.appendChild(custom);
    }
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    select.onchange = () => {
      const mins = document.getElementById('roundTimerMinutes');
      const opt = select.selectedOptions[0];
      if (mins && opt?.dataset.duration) mins.value = opt.dataset.duration;
    };
  }

  function addTimer() {
    const select = document.getElementById('roundTimerTask');
    const minutesInput = document.getElementById('roundTimerMinutes');
    const minutes = Math.max(1, Math.min(240, Number(minutesInput?.value || 25)));
    const title = select?.selectedOptions[0]?.textContent || 'Custom timer';
    const duration = minutes * 60;
    const timers = readTimers();
    timers.push({ id: makeId(), title, duration, remaining: duration, running: false, createdAt: new Date().toISOString(), lastTick: null });
    saveTimers(timers);
    renderTimers();
  }

  function updateRunningTimers() {
    const now = Date.now();
    const timers = readTimers().map(timer => {
      if (!timer.running) return timer;
      const last = timer.lastTick || now;
      const elapsed = Math.floor((now - last) / 1000);
      if (elapsed <= 0) return timer;
      const remaining = Math.max(0, Number(timer.remaining || 0) - elapsed);
      return { ...timer, remaining, running: remaining > 0, lastTick: now };
    });
    saveTimers(timers);
  }

  function toggleTimer(id) {
    updateRunningTimers();
    const timers = readTimers().map(timer => {
      if (timer.id !== id) return timer;
      return { ...timer, running: !timer.running && timer.remaining > 0, lastTick: Date.now() };
    });
    saveTimers(timers);
    renderTimers();
  }
  function restartTimer(id) {
    const timers = readTimers().map(timer => timer.id === id ? { ...timer, remaining: timer.duration, running: false, lastTick: null } : timer);
    saveTimers(timers);
    renderTimers();
  }
  function endTimer(id) {
    const timers = readTimers().map(timer => timer.id === id ? { ...timer, remaining: 0, running: false, lastTick: null } : timer);
    saveTimers(timers);
    renderTimers();
  }
  function removeTimer(id) {
    saveTimers(readTimers().filter(timer => timer.id !== id));
    renderTimers();
  }

  function renderTimers() {
    ensurePanel();
    renderTaskOptions();
    updateRunningTimers();
    const list = document.getElementById('roundTimers');
    if (!list) return;
    const timers = readTimers();
    if (!timers.length) {
      list.innerHTML = '<p class="timer-empty">Add a task timer from your calendar.</p>';
      return;
    }
    list.innerHTML = '';
    timers.forEach(timer => {
      const progress = timer.duration ? Math.max(0, Math.min(1, timer.remaining / timer.duration)) : 0;
      const card = document.createElement('article');
      card.className = `round-timer-card ${timer.running ? 'running' : ''}`;
      card.innerHTML = `
        <div class="round-clock" style="--remaining:${progress}">
          <span>${fmt(timer.remaining)}</span>
        </div>
        <h3>${timer.title}</h3>
        <div class="round-timer-actions">
          <button type="button" data-action="toggle">${timer.running ? 'Pause' : 'Play'}</button>
          <button type="button" data-action="restart" class="ghost">Restart</button>
          <button type="button" data-action="end" class="ghost">End</button>
          <button type="button" data-action="remove" class="ghost">Remove</button>
        </div>
      `;
      card.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleTimer(timer.id));
      card.querySelector('[data-action="restart"]').addEventListener('click', () => restartTimer(timer.id));
      card.querySelector('[data-action="end"]').addEventListener('click', () => endTimer(timer.id));
      card.querySelector('[data-action="remove"]').addEventListener('click', () => removeTimer(timer.id));
      list.appendChild(card);
    });
  }

  function startTick() {
    if (tick) return;
    tick = setInterval(renderTimers, 1000);
  }

  function init() {
    ensurePanel();
    renderTimers();
    startTick();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
  document.addEventListener('drop', () => setTimeout(renderTaskOptions, 120), true);
  document.addEventListener('click', event => {
    if (event.target.closest('.task-card,.slot,#prevWeek,#nextWeek,#todayWeek')) setTimeout(renderTaskOptions, 120);
  }, true);
})();
