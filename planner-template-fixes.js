(() => {
  if (window.__plannerTemplateFixesLoaded) return;
  window.__plannerTemplateFixesLoaded = true;

  const TEMPLATE_SOURCE = "recurring-template";
  const COPY_SOURCE = "recurring-copy";
  const EFFORT_LABELS = { low: "Low", medium: "Medium", high: "High" };
  const TYPE_OPTIONS = ["Study", "Daily Reset", "Admin", "Cleaning", "Room Setup", "Shopping", "Clothes", "Creative", "Life Planning", "Rest"];

  let calendarFullscreen = false;
  let focusDay = null;

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

  function setEffort(instance, value) {
    const effort = EFFORT_LABELS[value] ? value : "medium";
    if (instance.taskId) {
      const task = getTask(instance.taskId);
      if (task) task.energy = effort;
      getWeekInstances().forEach(item => {
        if (item.taskId === instance.taskId) item.energy = "";
      });
    } else {
      instance.energy = effort;
    }
  }

  function setTypeAndCategory(instance, type, category) {
    const cleanType = TYPE_OPTIONS.includes(type) ? type : "Admin";
    const cleanCategory = String(category || cleanType).trim();
    if (instance.taskId) {
      const task = getTask(instance.taskId);
      if (task) {
        task.type = cleanType;
        task.category = cleanCategory;
      }
      getWeekInstances().forEach(item => {
        if (item.taskId === instance.taskId) {
          item.type = "";
          item.category = "";
        }
      });
    } else {
      instance.type = cleanType;
      instance.category = cleanCategory;
    }
  }

  function setDetails(instance, details) {
    const clean = String(details || "").trim();
    if (instance.taskId) {
      const task = getTask(instance.taskId);
      if (task) task.details = clean;
    } else {
      instance.details = clean;
    }
    instance.note = clean;
  }

  function ensureOptionsModal() {
    let modal = document.getElementById("taskOptionsModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "taskOptionsModal";
    modal.className = "planner-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="planner-modal-card" role="dialog" aria-modal="true" aria-labelledby="taskOptionsTitle">
        <button type="button" class="planner-modal-close" aria-label="Close options">×</button>
        <h2 id="taskOptionsTitle">Task options</h2>
        <form id="taskOptionsForm" class="planner-options-form">
          <label>Intensity
            <select id="taskOptionsIntensity">
              <option value="low">Low ★</option>
              <option value="medium">Medium ★★</option>
              <option value="high">High ★★★</option>
            </select>
          </label>
          <label>Category
            <select id="taskOptionsType"></select>
          </label>
          <label>Custom category label
            <input id="taskOptionsCategory" type="text" placeholder="Uni, Personal, Cleaning...">
          </label>
          <label>Details
            <textarea id="taskOptionsDetails" rows="4" placeholder="Optional notes for this task"></textarea>
          </label>
          <div class="planner-modal-actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost planner-modal-cancel">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    const typeSelect = modal.querySelector("#taskOptionsType");
    TYPE_OPTIONS.forEach(type => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      typeSelect.appendChild(option);
    });
    modal.addEventListener("click", event => {
      if (event.target === modal || event.target.closest(".planner-modal-close") || event.target.closest(".planner-modal-cancel")) {
        modal.hidden = true;
      }
    });
    return modal;
  }

  function openTaskOptions(instance) {
    const modal = ensureOptionsModal();
    const data = modelFor(instance);
    modal.dataset.instanceId = instance.id;
    modal.querySelector("#taskOptionsTitle").textContent = data.baseTitle || data.title || "Task options";
    modal.querySelector("#taskOptionsIntensity").value = (data.energy || "medium").toLowerCase();
    modal.querySelector("#taskOptionsType").value = TYPE_OPTIONS.includes(data.type) ? data.type : "Admin";
    modal.querySelector("#taskOptionsCategory").value = data.category || data.type || "";
    modal.querySelector("#taskOptionsDetails").value = data.details || instance.note || "";
    modal.hidden = false;
    modal.querySelector("#taskOptionsIntensity")?.focus();

    const form = modal.querySelector("#taskOptionsForm");
    form.onsubmit = event => {
      event.preventDefault();
      const current = getWeekInstances().find(item => item.id === modal.dataset.instanceId && !item.deleted);
      if (!current) return;
      setEffort(current, modal.querySelector("#taskOptionsIntensity").value);
      setTypeAndCategory(current, modal.querySelector("#taskOptionsType").value, modal.querySelector("#taskOptionsCategory").value);
      setDetails(current, modal.querySelector("#taskOptionsDetails").value);
      normaliseTemplates();
      saveState();
      modal.hidden = true;
      render();
    };
  }

  function attachOptionsButton(card, instance) {
    const button = card.querySelector(".details-button");
    if (!button) return;
    const clean = button.cloneNode(true);
    clean.textContent = "Options";
    clean.classList.add("options-button");
    clean.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openTaskOptions(instance);
    });
    button.replaceWith(clean);
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
    attachOptionsButton(card, instance);

    if (isTaskTemplate(instance)) {
      card.classList.add("template-card");
      card.setAttribute("aria-label", `${data.baseTitle} reusable template. Drag to copy into the calendar.`);
      const meta = card.querySelector(".task-meta");
      if (meta) {
        meta.textContent = [
          `${data.duration} min`,
          data.priority,
          data.type,
          data.energy
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

  function ensureColourStrengthControl() {
    const toolbar = document.querySelector(".mock-calendar-toolbar .toggles");
    if (!toolbar || document.getElementById("visualIntensity")) return;
    state.settings.visualIntensity ||= "balanced";
    const label = document.createElement("label");
    label.className = "visual-intensity-control calendar-tip";
    label.dataset.tip = "Choose how strong the planner colours and patchwork border feel.";
    label.innerHTML = `
      <span>Colour strength</span>
      <select id="visualIntensity" aria-label="Colour strength">
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

  function installCalendarFocusControls() {
    const corner = document.querySelector(".mock-calendar-box .corner");
    if (corner && !corner.querySelector(".calendar-focus-toggle")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-focus-toggle";
      button.addEventListener("click", event => {
        event.stopPropagation();
        calendarFullscreen = !calendarFullscreen;
        applyCalendarFocusState();
      });
      corner.appendChild(button);
    }

    document.querySelectorAll(".mock-calendar-box .day-header").forEach((header, index) => {
      header.dataset.day = String(index);
      if (!header.dataset.dayFocusReady) {
        header.dataset.dayFocusReady = "true";
        header.addEventListener("click", () => {
          focusDay = focusDay === index ? null : index;
          applyCalendarFocusState();
        });
      }
    });
    applyCalendarFocusState();
  }

  function applyCalendarFocusState() {
    document.body.classList.toggle("calendar-fullscreen", calendarFullscreen);
    document.body.classList.toggle("day-focus", focusDay !== null);
    if (focusDay === null) document.body.removeAttribute("data-focus-day");
    else document.body.setAttribute("data-focus-day", String(focusDay));
    document.querySelectorAll(".mock-calendar-box .day-header").forEach((header, index) => {
      header.classList.toggle("focused-day", focusDay === index);
    });
    const button = document.querySelector(".calendar-focus-toggle");
    if (button) button.textContent = calendarFullscreen ? "Exit" : "Full";
  }

  const originalRender = render;
  render = function templateRender() {
    normaliseTemplates();
    originalRender();
    ensureColourStrengthControl();
    applyIntensityClass();
    installCalendarFocusControls();
  };

  normaliseTemplates();
  state.settings.visualIntensity ||= "balanced";
  saveState();
  setTimeout(() => render(), 0);
})();
