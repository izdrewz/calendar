(() => {
  if (window.__plannerDayFocusActionsLoaded) return;
  window.__plannerDayFocusActionsLoaded = true;

  const TIMER_KEY = 'calendar-round-timers-v1';
  const CATEGORY_OPTIONS = {
    'uni': { type: 'Study', category: 'uni study', labels: ['uni', 'study', 'exam', 'note'] },
    'self-care': { type: 'Daily Reset', category: 'self care', labels: ['self care', 'daily reset', 'journal', 'rest', 'gaming', 'keyboard'] },
    'personal': { type: 'Admin', category: 'personal admin', labels: ['personal', 'admin', 'shopping', 'gift', 'messages', 'reply'] },
    'cleaning': { type: 'Cleaning', category: 'cleaning', labels: ['cleaning', 'clean', 'vacuum', 'surface', 'mirror', 'rubbish', 'recycling', 'crockery'] },
    'projects': { type: 'Room Setup', category: 'projects', labels: ['projects', 'project', 'room setup', 'storage', 'shelves', 'bug', 'noise'] },
    'creativity': { type: 'Creative', category: 'creativity crafts', labels: ['creativity', 'creative', 'craft', 'crochet', 'dress', 'upscale'] },
    'clothes': { type: 'Clothes', category: 'clothes', labels: ['clothes', 'vinted', 'sell', 'stock'] },
    'one-off': { type: 'Admin', category: 'one-off', labels: ['one-off', 'one off'] },
    'other': { type: 'Admin', category: 'other', labels: ['other'] }
  };

  let activeCalendarCard = null;
  let lastFocusDay = null;

  function makeId() {
    return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function readTimers() {
    try { return JSON.parse(localStorage.getItem(TIMER_KEY)) || []; }
    catch { return []; }
  }

  function saveTimers(timers) {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timers));
  }

  function currentFocusedDay() {
    if (!document.body.classList.contains('day-focus')) return null;
    const raw = document.body.getAttribute('data-focus-day');
    if (raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function applySingleDayVisibility() {
    const focusDay = currentFocusedDay();
    const calendar = document.getElementById('calendar');
    if (!calendar) return;
    calendar.querySelectorAll('.day-focus-hidden,.day-focus-visible').forEach(el => {
      el.classList.remove('day-focus-hidden', 'day-focus-visible');
    });
    if (focusDay === null) return;
    calendar.querySelectorAll('.day-header').forEach(header => {
      const day = Number(header.dataset.day);
      header.classList.add(day === focusDay ? 'day-focus-visible' : 'day-focus-hidden');
    });
    calendar.querySelectorAll('.slot').forEach(slot => {
      const day = Number(slot.dataset.day);
      slot.classList.add(day === focusDay ? 'day-focus-visible' : 'day-focus-hidden');
    });
    calendar.querySelectorAll('.time-label').forEach(label => label.classList.add('day-focus-visible'));
    calendar.querySelector('.corner')?.classList.add('day-focus-visible');
  }

  function cardData(card) {
    const id = card?.dataset?.instanceId || '';
    const instance = typeof getWeekInstances === 'function' ? getWeekInstances().find(item => item.id === id) : null;
    const data = instance && typeof modelFor === 'function' ? modelFor(instance) : null;
    const title = data?.baseTitle || data?.title || card?.querySelector('h3')?.textContent?.trim() || 'Task';
    const duration = Number(data?.duration || instance?.duration || 25);
    const meta = card?.querySelector('.task-meta')?.textContent?.trim() || '';
    const details = [data?.step ? `First step: ${data.step}` : '', data?.details ? `Details: ${data.details}` : '', instance?.note ? `Note: ${instance.note}` : ''].filter(Boolean).join('\n');
    return { id, instance, data, title, duration, meta, details };
  }

  function startTimerForCard(card) {
    const info = cardData(card);
    const duration = Math.max(1, Math.min(240, Number(info.duration || 25))) * 60;
    const timers = readTimers().map(timer => ({ ...timer, running: false, lastTick: timer.running ? Date.now() : timer.lastTick }));
    timers.unshift({
      id: makeId(),
      title: info.title,
      duration,
      remaining: duration,
      running: true,
      createdAt: new Date().toISOString(),
      lastTick: Date.now(),
      plannerInstanceId: info.id || null
    });
    saveTimers(timers.slice(0, 24));
    document.getElementById('timerPopup')?.removeAttribute('hidden');
    document.getElementById('timerClockButton')?.setAttribute('aria-expanded', 'true');
    window.dispatchEvent(new CustomEvent('planner:start-task-timer', { detail: { instanceId: info.id, title: info.title, duration: duration / 60 } }));
    document.dispatchEvent(new Event('click'));
    setTimeout(() => {
      document.getElementById('timerClockButton')?.click();
      document.getElementById('timerClockButton')?.click();
    }, 40);
  }

  function ensureStartButton() {
    const pop = document.getElementById('calendarTaskPopover');
    if (!pop) return;
    const actions = pop.querySelector('.calendar-task-popover-actions');
    if (!actions || actions.querySelector('[data-action="start-task"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'start-task';
    button.className = 'calendar-start-task-button';
    button.textContent = 'Start task';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (activeCalendarCard) startTimerForCard(activeCalendarCard);
    });
    actions.prepend(button);
  }

  function improvePopover() {
    ensureStartButton();
    const pop = document.getElementById('calendarTaskPopover');
    if (!pop || pop.hidden || !activeCalendarCard) return;
    const info = cardData(activeCalendarCard);
    const step = pop.querySelector('.calendar-task-popover-step');
    if (step && info.details) {
      step.hidden = false;
      step.textContent = info.details;
    }
  }

  function trackActiveCard(event) {
    const card = event.target.closest?.('#calendar .task-card');
    if (card) activeCalendarCard = card;
    setTimeout(improvePopover, 30);
  }

  function setCategoryDirect(instance, categoryId, customLabel) {
    const option = CATEGORY_OPTIONS[categoryId] || CATEGORY_OPTIONS.other;
    const category = String(customLabel || option.category).trim();
    if (instance.taskId && typeof getTask === 'function') {
      const task = getTask(instance.taskId);
      if (task) {
        task.type = option.type;
        task.category = category;
        task.categoryGroup = categoryId;
      }
      if (typeof getWeekInstances === 'function') {
        getWeekInstances().forEach(item => {
          if (item.taskId === instance.taskId) {
            item.categoryGroup = categoryId;
            item.categoryOverride = category;
            item.typeOverride = option.type;
          }
        });
      }
    } else {
      instance.type = option.type;
      instance.category = category;
      instance.categoryGroup = categoryId;
    }
  }

  function modelCategoryId(data) {
    const text = [data?.task?.categoryGroup, data?.categoryGroup, data?.type, data?.category, data?.baseTitle, data?.title].filter(Boolean).join(' ').toLowerCase();
    const direct = Object.keys(CATEGORY_OPTIONS).find(id => text.includes(id));
    if (direct) return direct;
    return Object.entries(CATEGORY_OPTIONS).find(([, option]) => option.labels.some(label => text.includes(label)))?.[0] || 'other';
  }

  function patchModelForCategory() {
    if (window.__plannerDayFocusModelPatch || typeof modelFor !== 'function') return;
    window.__plannerDayFocusModelPatch = true;
    const previous = modelFor;
    modelFor = function modelForWithCategoryOverride(instance) {
      const data = previous(instance);
      if (instance?.categoryGroup || instance?.categoryOverride || instance?.typeOverride) {
        data.categoryGroup = instance.categoryGroup || modelCategoryId(data);
        data.category = instance.categoryOverride || data.category;
        data.type = instance.typeOverride || data.type;
      } else if (instance?.taskId && typeof getTask === 'function') {
        const task = getTask(instance.taskId);
        if (task?.categoryGroup) data.categoryGroup = task.categoryGroup;
      }
      return data;
    };
  }

  function interceptOptionsSubmit(event) {
    const form = event.target.closest?.('#taskOptionsForm');
    if (!form) return;
    const modal = form.closest('#taskOptionsModal');
    const instanceId = modal?.dataset?.instanceId;
    const categoryId = form.querySelector('#taskOptionsCategoryGroup')?.value;
    const custom = form.querySelector('#taskOptionsCategory')?.value;
    if (!instanceId || !categoryId || typeof getWeekInstances !== 'function') return;
    const instance = getWeekInstances().find(item => item.id === instanceId && !item.deleted);
    if (!instance) return;
    setTimeout(() => {
      setCategoryDirect(instance, categoryId, custom);
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
    }, 0);
  }

  function patchPilesCategory() {
    if (window.__plannerDayFocusPilePatch) return;
    window.__plannerDayFocusPilePatch = true;
    document.addEventListener('click', event => {
      const button = event.target.closest?.('#pileGroupTabs .category-box[data-group]');
      if (!button) return;
      setTimeout(() => {
        document.querySelectorAll('.clear-drag-tray .task-card').forEach(card => {
          const id = card.dataset.instanceId;
          const instance = typeof getWeekInstances === 'function' ? getWeekInstances().find(item => item.id === id) : null;
          if (!instance || typeof modelFor !== 'function') return;
          const data = modelFor(instance);
          const categoryId = data.categoryGroup || modelCategoryId(data);
          card.dataset.categoryGroup = categoryId;
        });
      }, 90);
    }, true);
  }

  function postRender() {
    patchModelForCategory();
    applySingleDayVisibility();
    improvePopover();
    const focusDay = currentFocusedDay();
    if (focusDay !== lastFocusDay) {
      lastFocusDay = focusDay;
      setTimeout(applySingleDayVisibility, 60);
    }
  }

  document.addEventListener('click', trackActiveCard, true);
  document.addEventListener('pointerover', trackActiveCard, true);
  document.addEventListener('submit', interceptOptionsSubmit, true);
  document.addEventListener('change', event => {
    if (event.target.matches?.('#taskOptionsCategoryGroup')) {
      const input = document.getElementById('taskOptionsCategory');
      const option = CATEGORY_OPTIONS[event.target.value] || CATEGORY_OPTIONS.other;
      if (input) input.value = option.category;
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => { patchModelForCategory(); patchPilesCategory(); setTimeout(postRender, 80); });
  window.addEventListener('load', () => setTimeout(postRender, 120));
  document.addEventListener('click', () => setTimeout(postRender, 90), true);
  document.addEventListener('drop', () => setTimeout(postRender, 140), true);
  document.addEventListener('change', () => setTimeout(postRender, 90), true);
})();
