(() => {
  if (window.__plannerTemplateFixesLoaded) return;
  window.__plannerTemplateFixesLoaded = true;

  const TEMPLATE_SOURCE = "recurring-template";
  const COPY_SOURCE = "recurring-copy";

  function week() {
    const key = currentWeekKey();
    state.weeks[key] ||= { instances: [] };
    state.weeks[key].instances ||= [];
    return state.weeks[key];
  }

  function isTaskTemplate(instance) {
    return Boolean(instance?.taskId)
      && !instance.deleted
      && !instance.scheduledAt
      && instance.status !== "done"
      && instance.status !== "skipped"
      && (instance.template || instance.source === TEMPLATE_SOURCE || instance.source === "recurring" || instance.source === "recurring-extra");
  }

  function isLooseRecurringCopy(instance) {
    return Boolean(instance?.taskId)
      && !instance.deleted
      && !instance.scheduledAt
      && instance.source === COPY_SOURCE;
  }

  function makeTemplate(task) {
    return {
      id: makeId(),
      source: TEMPLATE_SOURCE,
      taskId: task.id,
      sequence: 1,
      weekKey: currentWeekKey(),
      scheduledAt: null,
      duration: task.duration,
      status: "unscheduled",
      note: "",
      notified: false,
      removable: false,
      template: true,
      createdAt: new Date().toISOString()
    };
  }

  function normaliseTemplates() {
    const current = week();
    current.instances.forEach(instance => {
      if (isLooseRecurringCopy(instance)) instance.deleted = true;
    });

    state.tasks.filter(task => !task.archived).forEach(task => {
      const active = current.instances.filter(instance => instance.taskId === task.id && !instance.deleted);
      const templates = active.filter(isTaskTemplate);
      let keeper = templates[0];

      if (!keeper) {
        keeper = makeTemplate(task);
        current.instances.push(keeper);
      }

      keeper.source = TEMPLATE_SOURCE;
      keeper.template = true;
      keeper.sequence = 1;
      keeper.scheduledAt = null;
      keeper.status = "unscheduled";
      keeper.duration = task.duration;
      keeper.removable = false;

      templates.slice(1).forEach(instance => { instance.deleted = true; });
    });
  }

  const originalEnsureWeek = ensureWeek;
  ensureWeek = function templateEnsureWeek() {
    state.weeks[currentWeekKey()] ||= { instances: [] };
    state.weeks[currentWeekKey()].instances ||= [];
    normaliseTemplates();
  };

  const originalModelFor = modelFor;
  modelFor = function templateModelFor(instance) {
    const data = originalModelFor(instance);
    if (instance?.taskId) data.title = data.baseTitle;
    return data;
  };

  const originalScheduleInstance = scheduleInstance;
  scheduleInstance = function templateScheduleInstance(instanceId, dayIndex, minutes) {
    const current = week();
    const instance = current.instances.find(item => item.id === instanceId && !item.deleted);

    if (instance?.taskId && isTaskTemplate(instance)) {
      const task = getTask(instance.taskId);
      const count = current.instances.filter(item => item.taskId === instance.taskId && item.scheduledAt && !item.deleted).length;
      const copy = {
        ...instance,
        id: makeId(),
        source: COPY_SOURCE,
        template: false,
        removable: true,
        sequence: count + 1,
        scheduledAt: null,
        status: "unscheduled",
        note: "",
        notified: false,
        duration: instance.duration || task?.duration || 30,
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

  const originalAddManualInstance = addManualInstance;
  addManualInstance = function templateAddManualInstance(task) {
    const current = week();
    const existing = current.instances.find(instance => instance.taskId === task.id && isTaskTemplate(instance));
    if (!existing) current.instances.push(makeTemplate(task));
    normaliseTemplates();
    saveState();
  };

  const originalRenderWeekSummary = renderWeekSummary;
  renderWeekSummary = function templateRenderWeekSummary() {
    const end = addDays(selectedWeekStart, 6);
    els.weekLabel.textContent = `${formatDate(selectedWeekStart, { month: "short", day: "numeric" })} – ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
    const instances = getWeekInstances();
    const scheduled = instances.filter(item => item.scheduledAt).length;
    const done = instances.filter(item => item.status === "done" && item.scheduledAt).length;
    els.progressText.textContent = scheduled ? `${done} done of ${scheduled} scheduled` : "0 scheduled";
  };

  const originalCreateInstanceCard = createInstanceCard;
  createInstanceCard = function templateCreateInstanceCard(instance) {
    const card = originalCreateInstanceCard(instance);
    const data = modelFor(instance);
    const title = card.querySelector("h3");
    if (title) title.textContent = data.baseTitle || data.title;

    if (isTaskTemplate(instance)) {
      card.classList.add("template-card");
      card.setAttribute("aria-label", `${data.baseTitle} reusable template. Drag to copy into the calendar.`);
      const meta = card.querySelector(".task-meta");
      if (meta) {
        meta.textContent = [
          `${data.duration} min`,
          data.priority,
          data.type,
          data.energy,
          "reusable"
        ].filter(Boolean).join(" • ");
      }
      const done = card.querySelector(".done-button");
      const skip = card.querySelector(".skip-button");
      const unplan = card.querySelector(".unschedule-button");
      if (done) done.hidden = true;
      if (skip) skip.hidden = true;
      if (unplan) unplan.hidden = true;
    }
    return card;
  };

  function ensureIntensityControl() {
    const toolbar = document.querySelector(".mock-calendar-toolbar .toggles");
    if (!toolbar || document.getElementById("visualIntensity")) return;
    state.settings.visualIntensity ||= "balanced";
    const label = document.createElement("label");
    label.className = "visual-intensity-control calendar-tip";
    label.dataset.tip = "Choose how strong the planner colours and patchwork border feel.";
    label.innerHTML = `
      <span>Intensity</span>
      <select id="visualIntensity" aria-label="Visual intensity">
        <option value="soft">Soft</option>
        <option value="balanced">Balanced</option>
        <option value="bold">Bold</option>
      </select>
    `;
    toolbar.prepend(label);
    const select = label.querySelector("select");
    select.value = state.settings.visualIntensity;
    select.addEventListener("change", () => {
      state.settings.visualIntensity = select.value;
      saveState();
      applyIntensityClass();
    });
  }

  function applyIntensityClass() {
    const value = state.settings.visualIntensity || "balanced";
    document.body.classList.toggle("intensity-soft", value === "soft");
    document.body.classList.toggle("intensity-balanced", value === "balanced");
    document.body.classList.toggle("intensity-bold", value === "bold");
    const select = document.getElementById("visualIntensity");
    if (select) select.value = value;
  }

  const originalRender = render;
  render = function templateRender() {
    normaliseTemplates();
    originalRender();
    ensureIntensityControl();
    applyIntensityClass();
  };

  normaliseTemplates();
  state.settings.visualIntensity ||= "balanced";
  saveState();
  setTimeout(() => render(), 0);
})();
