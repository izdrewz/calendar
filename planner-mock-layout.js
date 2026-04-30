(() => {
  const CATEGORY_COLOURS = [
    { key: 'Study|Uni|exam|note', name: 'uni', colour: '#3f78b5' },
    { key: 'Daily Reset|Self care|journal|rest|gaming|keyboard', name: 'self-care', colour: '#7fa84b' },
    { key: 'Admin|Personal|shopping|gift|messages|reply', name: 'personal', colour: '#d85f7b' },
    { key: 'Cleaning|cleaning|vacuum|surface|mirror|rubbish|recycling|crockery', name: 'cleaning', colour: '#45a9bd' },
    { key: 'Room Setup|Projects|shelves|storage|bug|noise|labels', name: 'projects', colour: '#c02f36' },
    { key: 'Creative|Creativity|Crafts|crochet|dress|upscale|cardboard|canderel', name: 'creativity', colour: '#a85aa0' },
    { key: 'Clothes|clothes|sell|stock|vinted|photos', name: 'clothes', colour: '#77824f' },
    { key: 'one-off|One-off', name: 'one-off', colour: '#b9742f' },
    { key: 'Other', name: 'other', colour: '#4f2441' }
  ];
  const ENERGY_STARS = { low: 1, medium: 2, high: 3 };
  let templateModeInstalled = false;
  let refreshFrame = null;

  function categoryForCard(card) {
    if (card.dataset.categoryGroup) {
      return CATEGORY_COLOURS.find(item => item.name === card.dataset.categoryGroup) || CATEGORY_COLOURS[CATEGORY_COLOURS.length - 1];
    }
    const text = [
      card.querySelector('h3')?.textContent,
      card.querySelector('.type-badge')?.textContent,
      card.querySelector('.task-meta')?.textContent,
      card.querySelector('.tiny-step')?.textContent,
      card.classList.contains('one-off') ? 'one-off' : ''
    ].join(' ').toLowerCase();
    return CATEGORY_COLOURS.find(item => item.key.toLowerCase().split('|').some(term => text.includes(term))) || CATEGORY_COLOURS[CATEGORY_COLOURS.length - 1];
  }

  function formatToday() {
    const dateTarget = document.getElementById('currentDateText');
    const weekTarget = document.getElementById('headerWeekRange');
    const singleTarget = document.getElementById('todayDateLabel');
    const week = document.getElementById('weekLabel')?.textContent?.trim();
    const now = new Date();
    const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    if (dateTarget && weekTarget) {
      dateTarget.textContent = today;
      weekTarget.textContent = week && week !== 'Week' ? week : '';
      return;
    }
    if (singleTarget) singleTarget.textContent = week && week !== 'Week' ? `${today}\n${week}` : today;
  }

  function energyFromCard(card) {
    const text = [card.querySelector('.task-meta')?.textContent, card.textContent].join(' ').toLowerCase();
    if (text.includes('high')) return 'high';
    if (text.includes('low')) return 'low';
    return 'medium';
  }

  function styleTaskCards() {
    document.querySelectorAll('.task-card').forEach(card => {
      const category = categoryForCard(card);
      card.dataset.category = category.name;
      card.style.setProperty('--task-colour', category.colour);
      const dot = card.querySelector('.status-dot');
      if (dot) dot.style.background = category.colour;
      const title = card.querySelector('h3');
      if (title) title.textContent = title.textContent.replace(/\s+\d+\s*\/\s*\d+\s*$/g, '');
      const titleRow = card.querySelector('.card-title-row');
      if (titleRow) {
        let stars = card.querySelector('.effort-stars');
        if (!stars) {
          stars = document.createElement('span');
          stars.className = 'effort-stars';
          titleRow.appendChild(stars);
        }
        const level = energyFromCard(card);
        stars.textContent = '★'.repeat(ENERGY_STARS[level] || 2);
        stars.title = `${level} intensity`;
        stars.dataset.intensity = level;
      }
      if (!card.closest('#calendar') && !card.classList.contains('one-off')) {
        card.classList.add('template-card');
      }
    });
  }

  function replaceStressfulProgress() {
    const progress = document.getElementById('progressText');
    const fill = document.getElementById('calendarProgressFill');
    if (!progress && !fill) return;
    const scheduledCards = [...document.querySelectorAll('#calendar .task-card')].filter(card => !card.classList.contains('skipped'));
    const scheduled = scheduledCards.length;
    const done = scheduledCards.filter(card => card.classList.contains('done')).length;
    const percent = scheduled ? Math.round((done / scheduled) * 100) : 0;
    if (progress) progress.textContent = scheduled ? `${done} done of ${scheduled} scheduled` : '0 scheduled';
    if (fill) fill.style.width = `${percent}%`;
  }

  function improveInjectedIcsButton() {
    const button = document.getElementById('exportCalendarIcs');
    if (!button || button.dataset.tipReady) return;
    button.classList.add('calendar-tip');
    button.dataset.tip = 'Exports only the tasks you have placed into the calendar as an .ics file you can import into another calendar app.';
    button.dataset.tipReady = 'true';
  }

  function installTemplateMode() {
    if (window.__plannerTemplateFixesLoaded) return;
    if (templateModeInstalled) return;
    if (typeof state === 'undefined' || typeof currentWeekKey === 'undefined' || typeof render !== 'function') return;
    templateModeInstalled = true;

    function week() {
      state.weeks[currentWeekKey()] ||= { instances: [] };
      state.weeks[currentWeekKey()].instances ||= [];
      return state.weeks[currentWeekKey()];
    }

    function reusableTemplate(instance) {
      return Boolean(instance?.taskId) && !instance.scheduledAt && instance.status !== 'done' && instance.status !== 'skipped' && !instance.deleted;
    }

    function normaliseTemplates() {
      const current = week();
      state.tasks.filter(task => !task.archived).forEach(task => {
        const active = current.instances.filter(instance => instance.taskId === task.id && !instance.deleted);
        let template = active.find(reusableTemplate);
        if (!template) {
          template = {
            id: makeId(),
            source: 'recurring-template',
            taskId: task.id,
            sequence: 1,
            weekKey: currentWeekKey(),
            scheduledAt: null,
            duration: task.duration,
            status: 'unscheduled',
            note: '',
            notified: false,
            removable: false,
            template: true,
            createdAt: new Date().toISOString()
          };
          current.instances.push(template);
        }
        let kept = false;
        current.instances.forEach(instance => {
          if (instance.taskId !== task.id || instance.deleted) return;
          if (!reusableTemplate(instance)) return;
          if (!kept) {
            kept = true;
            instance.source = 'recurring-template';
            instance.template = true;
            instance.sequence = 1;
            instance.scheduledAt = null;
            instance.status = 'unscheduled';
            instance.duration = task.duration;
            instance.removable = false;
          } else {
            instance.deleted = true;
          }
        });
      });
    }

    const originalScheduleInstance = scheduleInstance;
    scheduleInstance = function reusableScheduleInstance(instanceId, dayIndex, minutes) {
      const current = week();
      const original = current.instances.find(instance => instance.id === instanceId && !instance.deleted);
      if (original?.taskId && reusableTemplate(original)) {
        const task = getTask(original.taskId);
        const scheduledCount = current.instances.filter(item => item.taskId === original.taskId && item.scheduledAt && !item.deleted).length;
        const copy = {
          ...original,
          id: makeId(),
          source: 'recurring-copy',
          template: false,
          sequence: scheduledCount + 1,
          removable: true,
          scheduledAt: null,
          status: 'unscheduled',
          note: '',
          notified: false,
          duration: original.duration || task?.duration || 30,
          createdAt: new Date().toISOString()
        };
        current.instances.push(copy);
        saveState();
        originalScheduleInstance(copy.id, dayIndex, minutes);
        normaliseTemplates();
        saveState();
        render();
        return;
      }
      originalScheduleInstance(instanceId, dayIndex, minutes);
      normaliseTemplates();
      saveState();
    };

    const originalModelFor = modelFor;
    modelFor = function templateModelFor(instance) {
      const data = originalModelFor(instance);
      if (instance?.taskId) data.title = data.baseTitle;
      return data;
    };

    normaliseTemplates();
    saveState();
  }

  function compactCalendarAfterRender() {
    installTemplateMode();
    document.body.classList.add('mock-calendar-ready');
    formatToday();
    styleTaskCards();
    replaceStressfulProgress();
    improveInjectedIcsButton();
  }

  function scheduleRefresh(delay = 0) {
    if (refreshFrame) return;
    window.setTimeout(() => {
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = null;
        compactCalendarAfterRender();
      });
    }, delay);
  }

  document.addEventListener('DOMContentLoaded', () => scheduleRefresh());
  window.addEventListener('load', () => scheduleRefresh());
  document.addEventListener('click', () => scheduleRefresh(60), true);
  document.addEventListener('change', () => scheduleRefresh(60), true);
  document.addEventListener('drop', () => scheduleRefresh(120), true);
})();
