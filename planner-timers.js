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
    return task ? task.name : 'Planned task';
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
      <button id="timerClockButton" class="timer-clock-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Open timer options">
        <span id="timerClockValue">00:00</span>
      </button>
      <section id="timerPopup" class="timer-popup" hidden>
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
      </section>
    `;
    panel.querySelector('#roundTimerForm').addEventListener('submit', event => {
      event.preventDefault();
      addTimer();
      openPopup();
    });
    panel.querySelector('#timerClockButton').addEventListener('click', event => {
      event.stopPropagation();
      togglePopup();
    });
    document.addEventListener('click', event => {
      if (!panel.contains(event.target)) closePopup();
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closePopup();
    });
    return panel;
  }

  function openPopup() {
    const popup = document.getElementById('timerPopup');
    const button = document.getElementById('timerClockButton');
    if (!popup || !button) return;
    popup.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }
  function closePopup() {
    const popup = document.getElementById('timerPopup');
    const button = document.getElementById('timerClockButton');
    if (!popup || !button) return;
    popup.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  function togglePopup() {
    const popup = document.getElementById('timerPopup');
    if (!popup) return;
    popup.hidden ? openPopup() : closePopup();
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
      opt.textContent = 'Custom timer';
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
    openPopup();
  }
  function restartTimer(id) {
    const timers = readTimers().map(timer => timer.id === id ? { ...timer, remaining: timer.duration, running: false, lastTick: null } : timer);
    saveTimers(timers);
    renderTimers();
    openPopup();
  }
  function endTimer(id) {
    const timers = readTimers().map(timer => timer.id === id ? { ...timer, remaining: 0, running: false, lastTick: null } : timer);
    saveTimers(timers);
    renderTimers();
    openPopup();
  }
  function removeTimer(id) {
    saveTimers(readTimers().filter(timer => timer.id !== id));
    renderTimers();
    openPopup();
  }

  function updateClock(timers) {
    const clock = document.getElementById('timerClockValue');
    const button = document.getElementById('timerClockButton');
    if (!clock || !button) return;
    const timer = timers.find(item => item.running) || timers.find(item => item.remaining > 0) || timers[0];
    clock.textContent = timer ? fmt(timer.remaining) : '00:00';
    button.classList.toggle('running', Boolean(timer?.running));
    button.title = timer ? timer.title : 'Open timer options';
  }

  function renderTimers() {
    ensurePanel();
    renderTaskOptions();
    updateRunningTimers();
    const timers = readTimers();
    updateClock(timers);
    const list = document.getElementById('roundTimers');
    if (!list) return;
    list.innerHTML = '';
    timers.forEach(timer => {
      const progress = timer.duration ? Math.max(0, Math.min(1, timer.remaining / timer.duration)) : 0;
      const card = document.createElement('article');
      card.className = `round-timer-card ${timer.running ? 'running' : ''}`;
      card.innerHTML = `
        <button class="round-clock mini-clock" type="button" data-action="toggle" style="--remaining:${progress}">
          <span>${fmt(timer.remaining)}</span>
        </button>
        <h3>${timer.title}</h3>
        <div class="round-timer-actions">
          <button type="button" data-action="toggle">${timer.running ? 'Pause' : 'Play'}</button>
          <button type="button" data-action="restart" class="ghost">Restart</button>
          <button type="button" data-action="end" class="ghost">End</button>
          <button type="button" data-action="remove" class="ghost">Remove</button>
        </div>
      `;
      card.querySelectorAll('[data-action="toggle"]').forEach(button => button.addEventListener('click', () => toggleTimer(timer.id)));
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
