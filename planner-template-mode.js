(() => {
  if (window.__plannerTemplateModeLoaded) return;
  window.__plannerTemplateModeLoaded = true;

  const energyStars = { low: 1, medium: 2, high: 3 };

  function activeWeek() {
    state.weeks[currentWeekKey()] ||= { instances: [] };
    return state.weeks[currentWeekKey()];
  }

  function isReusableTemplate(instance) {
    return Boolean(instance?.taskId) && !instance.scheduledAt && instance.status !== 'done' && instance.status !== 'skipped' && !instance.deleted;
  }

  function normalizeTemplates() {
    const week = activeWeek();
    state.tasks.filter(task => !task.archived).forEach(task => {
      const active = week.instances.filter(instance => instance.taskId === task.id && !instance.deleted);
      let keptTemplate = active.find(isReusableTemplate);

      if (!keptTemplate) {
        keptTemplate = {
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
        week.instances.push(keptTemplate);
      }

      let templateSeen = false;
      week.instances.forEach(instance => {
        if (instance.taskId !== task.id || instance.deleted) return;
        if (isReusableTemplate(instance)) {
          if (!templateSeen) {
            templateSeen = true;
            instance.source = 'recurring-template';
            instance.template = true;
            instance.sequence = 1;
            instance.duration = task.duration;
            instance.status = 'unscheduled';
            instance.scheduledAt = null;
            instance.removable = false;
          } else {
            instance.deleted = true;
          }
        }
      });
    });
  }

  const baseEnsureWeek = window.ensureWeek;
  window.ensureWeek = function ensureWeekTemplateMode() {
    const key = currentWeekKey();
    state.weeks[key] ||= { instances: [] };
    state.weeks[key].instances ||= [];
    normalizeTemplates();
  };

  const baseModelFor = window.modelFor;
  window.modelFor = function modelForTemplateMode(instance) {
    const data = baseModelFor(instance);
    if (instance?.taskId) {
      data.title = data.baseTitle;
    }
    return data;
  };

  const baseScheduleInstance = window.scheduleInstance;
  window.scheduleInstance = function scheduleInstanceTemplateCopy(instanceId, dayIndex, minutes) {
    const week = activeWeek();
    const original = week.instances.find(item => item.id === instanceId && !item.deleted);

    if (original?.taskId && isReusableTemplate(original)) {
      const task = getTask(original.taskId);
      const scheduledCount = week.instances.filter(item => item.taskId === original.taskId && item.scheduledAt && !item.deleted).length;
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
      week.instances.push(copy);
      saveState();
      baseScheduleInstance(copy.id, dayIndex, minutes);
      normalizeTemplates();
      saveState();
      render();
      return;
    }

    baseScheduleInstance(instanceId, dayIndex, minutes);
    normalizeTemplates();
    saveState();
  };

  const baseCreateInstanceCard = window.createInstanceCard;
  window.createInstanceCard = function createInstanceCardTemplateMode(instance) {
    const card = baseCreateInstanceCard(instance);
    const data = modelFor(instance);
    const title = card.querySelector('h3');
    if (title) title.textContent = data.baseTitle || data.title;

    const titleRow = card.querySelector('.card-title-row');
    if (titleRow && !card.querySelector('.effort-stars')) {
      const stars = document.createElement('span');
      stars.className = 'effort-stars';
      const count = energyStars[String(data.energy || 'medium').toLowerCase()] || 2;
      stars.textContent = '★'.repeat(count);
      stars.title = `${data.energy || 'medium'} effort`;
      titleRow.appendChild(stars);
    }

    if (instance.taskId && isReusableTemplate(instance)) {
      card.classList.add('template-card');
      const unschedule = card.querySelector('.unschedule-button');
      const done = card.querySelector('.done-button');
      const skip = card.querySelector('.skip-button');
      if (unschedule) unschedule.hidden = true;
      if (done) done.textContent = 'Done after dragging';
      if (skip) skip.textContent = 'Hide';
    }

    return card;
  };

  normalizeTemplates();
  saveState();
  setTimeout(() => {
    try { render(); } catch (error) { console.warn('Template render refresh failed', error); }
  }, 0);
})();
