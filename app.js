const STORAGE_KEY = "focus-week-planner-v2";
const OLD_STORAGE_KEY = "focus-week-planner-v1";
const state = loadState();
let selectedWeekStart = startOfWeek(new Date());
let selectedInstanceId = null;
let focusSeconds = 25 * 60;
let focusInterval = null;

const els = {
  taskForm: document.getElementById("taskForm"),
  taskName: document.getElementById("taskName"),
  taskFrequency: document.getElementById("taskFrequency"),
  taskDuration: document.getElementById("taskDuration"),
  taskEnergy: document.getElementById("taskEnergy"),
  taskType: document.getElementById("taskType"),
  taskPriority: document.getElementById("taskPriority"),
  taskCategory: document.getElementById("taskCategory"),
  taskStep: document.getElementById("taskStep"),
  taskDetails: document.getElementById("taskDetails"),
  oneOffForm: document.getElementById("oneOffForm"),
  oneOffName: document.getElementById("oneOffName"),
  oneOffDuration: document.getElementById("oneOffDuration"),
  oneOffEnergy: document.getElementById("oneOffEnergy"),
  oneOffType: document.getElementById("oneOffType"),
  oneOffPriority: document.getElementById("oneOffPriority"),
  oneOffStep: document.getElementById("oneOffStep"),
  oneOffDetails: document.getElementById("oneOffDetails"),
  loadStarter: document.getElementById("loadStarter"),
  prevWeek: document.getElementById("prevWeek"),
  todayWeek: document.getElementById("todayWeek"),
  nextWeek: document.getElementById("nextWeek"),
  weekLabel: document.getElementById("weekLabel"),
  progressText: document.getElementById("progressText"),
  unscheduledList: document.getElementById("unscheduledList"),
  unscheduledCount: document.getElementById("unscheduledCount"),
  taskLibrary: document.getElementById("taskLibrary"),
  calendar: document.getElementById("calendar"),
  cardTemplate: document.getElementById("instanceCardTemplate"),
  calmMode: document.getElementById("calmMode"),
  hideDone: document.getElementById("hideDone"),
  enableReminders: document.getElementById("enableReminders"),
  exportData: document.getElementById("exportData"),
  importData: document.getElementById("importData"),
  focusTitle: document.getElementById("focusTitle"),
  focusText: document.getElementById("focusText"),
  startFocus: document.getElementById("startFocus"),
  resetFocus: document.getElementById("resetFocus"),
  focusTimer: document.getElementById("focusTimer")
};

init();

function init() {
  normalizeState();
  ensureWeek();
  bindEvents();
  registerServiceWorker();
  render();
  setInterval(checkReminders, 30000);
}

function bindEvents() {
  els.taskForm.addEventListener("submit", event => {
    event.preventDefault();
    const task = {
      id: makeId(),
      name: els.taskName.value.trim(),
      frequency: clamp(Number(els.taskFrequency.value), 1, 14),
      duration: clamp(Number(els.taskDuration.value), 5, 360),
      energy: els.taskEnergy.value,
      type: els.taskType.value,
      priority: els.taskPriority.value,
      category: els.taskCategory.value.trim(),
      step: els.taskStep.value.trim(),
      details: els.taskDetails.value.trim(),
      archived: false,
      createdAt: new Date().toISOString()
    };

    if (!task.name) return;
    state.tasks.push(task);
    ensureWeek();
    saveState();
    els.taskForm.reset();
    els.taskFrequency.value = "3";
    els.taskDuration.value = "45";
    els.taskEnergy.value = "medium";
    els.taskType.value = "Study";
    els.taskPriority.value = "High";
    render();
  });

  els.oneOffForm.addEventListener("submit", event => {
    event.preventDefault();
    const title = els.oneOffName.value.trim();
    if (!title) return;
    const week = state.weeks[currentWeekKey()];
    week.instances.push({
      id: makeId(),
      source: "one-off",
      title,
      duration: clamp(Number(els.oneOffDuration.value), 5, 360),
      energy: els.oneOffEnergy.value,
      type: els.oneOffType.value,
      priority: els.oneOffPriority.value,
      category: els.oneOffType.value,
      step: els.oneOffStep.value.trim(),
      details: els.oneOffDetails.value.trim(),
      scheduledAt: null,
      status: "unscheduled",
      note: "",
      notified: false,
      removable: true,
      createdAt: new Date().toISOString()
    });
    saveState();
    els.oneOffForm.reset();
    els.oneOffDuration.value = "30";
    els.oneOffEnergy.value = "medium";
    els.oneOffType.value = "Admin";
    els.oneOffPriority.value = "Medium";
    render();
  });

  els.loadStarter.addEventListener("click", () => {
    const added = addLifeAdminStarterPack();
    alert(added ? `Added ${added} life-admin task rules.` : "The starter pack is already loaded.");
    render();
  });

  els.prevWeek.addEventListener("click", () => changeWeek(-7));
  els.todayWeek.addEventListener("click", () => {
    selectedWeekStart = startOfWeek(new Date());
    ensureWeek();
    saveState();
    render();
  });
  els.nextWeek.addEventListener("click", () => changeWeek(7));

  els.calmMode.addEventListener("change", () => {
    state.settings.calmMode = els.calmMode.checked;
    saveState();
    render();
  });

  els.hideDone.addEventListener("change", () => {
    state.settings.hideDone = els.hideDone.checked;
    saveState();
    render();
  });

  els.enableReminders.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    state.settings.reminders = permission === "granted";
    saveState();
    render();
  });

  els.exportData.addEventListener("click", exportPlannerData);
  els.importData.addEventListener("change", importPlannerData);
  els.startFocus.addEventListener("click", toggleFocusTimer);
  els.resetFocus.addEventListener("click", () => {
    stopFocusTimer();
    focusSeconds = 25 * 60;
    renderFocusTimer();
  });
}

function changeWeek(days) {
  selectedWeekStart = addDays(selectedWeekStart, days);
  ensureWeek();
  saveState();
  render();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  } catch (error) {
    console.warn("Could not load planner data", error);
    return defaultState();
  }
}

function defaultState() {
  return {
    tasks: [],
    weeks: {},
    settings: {
      calmMode: false,
      hideDone: false,
      reminders: false,
      awakeStart: 6,
      awakeEnd: 23,
      slotMinutes: 30
    }
  };
}

function normalizeState() {
  state.tasks ||= [];
  state.weeks ||= {};
  state.settings ||= defaultState().settings;
  state.settings.awakeStart ??= 6;
  state.settings.awakeEnd ??= 23;
  state.settings.slotMinutes ??= 30;
  state.settings.calmMode ??= false;
  state.settings.hideDone ??= false;
  state.settings.reminders ??= false;
  state.tasks.forEach(task => {
    task.type ||= guessType(task.name);
    task.priority ||= "Medium";
    task.details ||= "";
    task.step ||= "";
  });
  Object.values(state.weeks).forEach(week => {
    week.instances ||= [];
    week.instances.forEach(instance => {
      instance.source ||= instance.taskId ? "recurring" : "one-off";
      instance.status ||= instance.scheduledAt ? "scheduled" : "unscheduled";
      instance.note ||= "";
      instance.details ||= "";
      instance.removable = instance.source === "one-off" || Boolean(instance.removable);
    });
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentWeekKey() {
  return weekKey(selectedWeekStart);
}

function weekKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function ensureWeek() {
  const key = currentWeekKey();
  state.weeks[key] ||= { instances: [] };
  const week = state.weeks[key];

  state.tasks.filter(task => !task.archived).forEach(task => {
    const existing = week.instances.filter(instance => instance.taskId === task.id && !instance.deleted);
    for (let i = existing.length; i < task.frequency; i += 1) {
      week.instances.push({
        id: makeId(),
        source: "recurring",
        taskId: task.id,
        sequence: i + 1,
        weekKey: key,
        scheduledAt: null,
        duration: task.duration,
        status: "unscheduled",
        note: "",
        notified: false,
        createdAt: new Date().toISOString()
      });
    }
  });
}

function getWeekInstances() {
  return (state.weeks[currentWeekKey()]?.instances || []).filter(instance => !instance.deleted);
}

function getTask(taskId) {
  return state.tasks.find(task => task.id === taskId);
}

function modelFor(instance) {
  const task = instance.taskId ? getTask(instance.taskId) : null;
  const isOneOff = instance.source === "one-off" || !instance.taskId;
  return {
    id: instance.id,
    title: isOneOff ? instance.title : `${task?.name || "Missing task"} ${instance.sequence || 1}/${task?.frequency || 1}`,
    baseTitle: isOneOff ? instance.title : task?.name || "Missing task",
    duration: instance.duration || task?.duration || 30,
    energy: instance.energy || task?.energy || "medium",
    type: instance.type || task?.type || guessType(task?.name || instance.title || ""),
    priority: instance.priority || task?.priority || "Medium",
    category: instance.category || task?.category || "",
    step: instance.step || task?.step || "",
    details: instance.details || task?.details || "",
    note: instance.note || "",
    isOneOff,
    task
  };
}

function render() {
  ensureWeek();
  document.body.classList.toggle("calm", Boolean(state.settings.calmMode));
  document.body.classList.toggle("hide-done", Boolean(state.settings.hideDone));
  els.calmMode.checked = Boolean(state.settings.calmMode);
  els.hideDone.checked = Boolean(state.settings.hideDone);
  els.enableReminders.textContent = state.settings.reminders ? "Reminders on" : "Enable reminders";
  renderWeekSummary();
  renderUnscheduled();
  renderTaskLibrary();
  renderCalendar();
  renderFocusPanel();
  renderFocusTimer();
}

function renderWeekSummary() {
  const end = addDays(selectedWeekStart, 6);
  els.weekLabel.textContent = `${formatDate(selectedWeekStart, { month: "short", day: "numeric" })} – ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
  const instances = getWeekInstances();
  const scheduled = instances.filter(item => item.scheduledAt).length;
  const done = instances.filter(item => item.status === "done").length;
  const oneOff = instances.filter(item => modelFor(item).isOneOff).length;
  els.progressText.textContent = `${scheduled}/${instances.length} scheduled • ${done}/${instances.length} done • ${oneOff} one-off`;
}

function renderUnscheduled() {
  els.unscheduledList.innerHTML = "";
  const items = getWeekInstances().filter(instance => !instance.scheduledAt && instance.status !== "done" && instance.status !== "skipped");
  els.unscheduledCount.textContent = String(items.length);
  items.sort(sortByPriority).forEach(instance => els.unscheduledList.appendChild(createInstanceCard(instance)));
}

function renderTaskLibrary() {
  els.taskLibrary.innerHTML = "";
  const tasks = state.tasks.filter(task => !task.archived);
  if (!tasks.length) {
    els.taskLibrary.innerHTML = `<p class="hint">Add rules above, or load the life-admin starter pack.</p>`;
    return;
  }

  tasks.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.name.localeCompare(b.name)).forEach(task => {
    const card = document.createElement("article");
    card.className = "rule-card";
    const instances = getWeekInstances().filter(instance => instance.taskId === task.id && !instance.deleted);
    const placed = instances.filter(instance => instance.scheduledAt).length;
    card.innerHTML = `
      <h3>${escapeHtml(task.name)}</h3>
      <p>${task.frequency}× weekly • ${task.duration} min • ${escapeHtml(task.priority)} • ${escapeHtml(task.type)}</p>
      <p>${placed}/${instances.length} placed this week${task.step ? ` • First: ${escapeHtml(task.step)}` : ""}</p>
      <div class="rule-actions">
        <button type="button" class="ghost" data-action="add-instance">+1 this week</button>
        <button type="button" class="ghost" data-action="edit-frequency">Change ×/week</button>
        <button type="button" class="ghost" data-action="edit-details">Details</button>
        <button type="button" class="ghost" data-action="archive">Archive</button>
      </div>
    `;

    card.querySelector('[data-action="add-instance"]').addEventListener("click", () => {
      addManualInstance(task);
      render();
    });

    card.querySelector('[data-action="edit-frequency"]').addEventListener("click", () => {
      const next = prompt(`How many times per week for "${task.name}"?`, String(task.frequency));
      if (next === null) return;
      task.frequency = clamp(Number(next), 1, 14);
      ensureWeek();
      saveState();
      render();
    });

    card.querySelector('[data-action="edit-details"]').addEventListener("click", () => {
      const next = prompt(`Details for "${task.name}"`, task.details || task.step || "");
      if (next === null) return;
      task.details = next.trim();
      saveState();
      render();
    });

    card.querySelector('[data-action="archive"]').addEventListener("click", () => {
      const ok = confirm(`Archive "${task.name}"? Future weeks will not create new copies.`);
      if (!ok) return;
      task.archived = true;
      saveState();
      render();
    });

    els.taskLibrary.appendChild(card);
  });
}

function addManualInstance(task) {
  const week = state.weeks[currentWeekKey()];
  const count = week.instances.filter(instance => instance.taskId === task.id && !instance.deleted).length;
  week.instances.push({
    id: makeId(),
    source: "recurring-extra",
    taskId: task.id,
    sequence: count + 1,
    weekKey: currentWeekKey(),
    scheduledAt: null,
    duration: task.duration,
    status: "unscheduled",
    note: "",
    notified: false,
    removable: true,
    createdAt: new Date().toISOString()
  });
  saveState();
}

function renderCalendar() {
  els.calendar.innerHTML = "";
  const corner = document.createElement("div");
  corner.className = "corner";
  els.calendar.appendChild(corner);

  for (let day = 0; day < 7; day += 1) {
    const date = addDays(selectedWeekStart, day);
    const header = document.createElement("div");
    header.className = `day-header${isToday(date) ? " today" : ""}`;
    header.innerHTML = `<div>${formatDate(date, { weekday: "short" })}</div><div>${formatDate(date, { month: "short", day: "numeric" })}</div>`;
    els.calendar.appendChild(header);
  }

  for (const minutes of slotMinutes()) {
    const time = document.createElement("div");
    time.className = "time-label";
    time.textContent = formatMinutes(minutes);
    els.calendar.appendChild(time);

    for (let day = 0; day < 7; day += 1) {
      const date = addDays(selectedWeekStart, day);
      const slot = document.createElement("div");
      slot.className = `slot${isToday(date) ? " today" : ""}`;
      slot.tabIndex = 0;
      slot.dataset.day = String(day);
      slot.dataset.minutes = String(minutes);
      slot.setAttribute("aria-label", `${formatDate(date, { weekday: "long" })} at ${formatMinutes(minutes)}`);

      slot.addEventListener("dragover", event => {
        event.preventDefault();
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
      slot.addEventListener("drop", event => {
        event.preventDefault();
        slot.classList.remove("drag-over");
        scheduleInstance(event.dataTransfer.getData("text/plain"), day, minutes);
      });
      slot.addEventListener("click", () => {
        if (selectedInstanceId) scheduleInstance(selectedInstanceId, day, minutes);
      });

      scheduledForSlot(day, minutes).forEach(instance => slot.appendChild(createInstanceCard(instance)));
      els.calendar.appendChild(slot);
    }
  }
}

function scheduledForSlot(dayIndex, minutes) {
  return getWeekInstances().filter(instance => {
    if (!instance.scheduledAt) return false;
    const date = new Date(instance.scheduledAt);
    const dayStart = addDays(selectedWeekStart, dayIndex);
    dayStart.setHours(0, 0, 0, 0);
    const instanceDay = new Date(date);
    instanceDay.setHours(0, 0, 0, 0);
    const instanceMinutes = date.getHours() * 60 + date.getMinutes();
    return instanceDay.getTime() === dayStart.getTime() && instanceMinutes === minutes;
  }).sort(sortByPriority);
}

function createInstanceCard(instance) {
  const data = modelFor(instance);
  const card = els.cardTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.instanceId = instance.id;
  card.classList.toggle("selected", selectedInstanceId === instance.id);
  card.classList.toggle("done", instance.status === "done");
  card.classList.toggle("skipped", instance.status === "skipped");
  card.classList.toggle("one-off", data.isOneOff);
  card.querySelector("h3").textContent = data.title;
  card.querySelector(".task-meta").textContent = [
    `${data.duration} min`,
    data.priority,
    data.type,
    data.energy,
    instance.scheduledAt ? formatDateTime(new Date(instance.scheduledAt)) : "not planned"
  ].filter(Boolean).join(" • ");
  card.querySelector(".tiny-step").textContent = [
    data.step ? `First step: ${data.step}` : "",
    data.details ? `Details: ${data.details}` : "",
    data.note ? `Note: ${data.note}` : ""
  ].filter(Boolean).join("\n");
  card.querySelector(".status-dot").classList.add(data.energy || "medium");
  card.querySelector(".type-badge").textContent = data.isOneOff ? "one-off" : data.type;
  card.querySelector(".type-badge").classList.toggle("one-off-badge", data.isOneOff);

  const removeButton = card.querySelector(".remove-button");
  removeButton.hidden = !data.isOneOff && !instance.removable;

  card.addEventListener("dragstart", event => {
    selectedInstanceId = instance.id;
    event.dataTransfer.setData("text/plain", instance.id);
    event.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(render);
  });

  card.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    selectedInstanceId = selectedInstanceId === instance.id ? null : instance.id;
    render();
  });

  card.querySelector(".done-button").addEventListener("click", () => {
    instance.status = instance.status === "done" ? (instance.scheduledAt ? "scheduled" : "unscheduled") : "done";
    saveState();
    render();
  });

  card.querySelector(".skip-button").addEventListener("click", () => {
    instance.status = instance.status === "skipped" ? (instance.scheduledAt ? "scheduled" : "unscheduled") : "skipped";
    saveState();
    render();
  });

  card.querySelector(".details-button").addEventListener("click", () => {
    const next = prompt(`Notes/details for "${data.baseTitle}"`, instance.note || data.details || "");
    if (next === null) return;
    instance.note = next.trim();
    saveState();
    render();
  });

  card.querySelector(".unschedule-button").addEventListener("click", () => {
    instance.scheduledAt = null;
    instance.status = "unscheduled";
    instance.notified = false;
    saveState();
    render();
  });

  removeButton.addEventListener("click", () => {
    const ok = confirm(`Remove "${data.baseTitle}" from this week?`);
    if (!ok) return;
    instance.deleted = true;
    selectedInstanceId = null;
    saveState();
    render();
  });

  return card;
}

function scheduleInstance(instanceId, dayIndex, minutes) {
  const instance = getWeekInstances().find(item => item.id === instanceId);
  if (!instance) return;
  const scheduled = addDays(selectedWeekStart, Number(dayIndex));
  scheduled.setHours(Math.floor(Number(minutes) / 60), Number(minutes) % 60, 0, 0);
  instance.scheduledAt = scheduled.toISOString();
  if (instance.status === "unscheduled" || instance.status === "skipped") instance.status = "scheduled";
  instance.notified = false;
  selectedInstanceId = null;
  saveState();
  render();
}

function renderFocusPanel() {
  const now = new Date();
  const todayInstances = getWeekInstances()
    .filter(instance => instance.scheduledAt && instance.status !== "done" && instance.status !== "skipped")
    .map(instance => ({ instance, when: new Date(instance.scheduledAt), data: modelFor(instance) }))
    .filter(item => isSameDate(item.when, now))
    .sort((a, b) => a.when - b.when);
  const next = todayInstances.find(item => item.when >= now) || todayInstances[0];

  if (!next) {
    const unplanned = getWeekInstances().find(instance => !instance.scheduledAt && instance.status === "unscheduled");
    els.focusTitle.textContent = unplanned ? "Pick one small thing" : "Today focus";
    els.focusText.textContent = unplanned
      ? `Try placing "${modelFor(unplanned).baseTitle}" somewhere today.`
      : "Nothing left for today. Nice.";
    return;
  }

  els.focusTitle.textContent = next.data.baseTitle;
  els.focusText.textContent = `${formatDateTime(next.when)} • ${next.data.duration} min • ${next.data.priority}${next.data.step ? ` • First step: ${next.data.step}` : ""}`;
}

function toggleFocusTimer() {
  if (focusInterval) {
    stopFocusTimer();
    return;
  }
  els.startFocus.textContent = "Pause";
  focusInterval = setInterval(() => {
    focusSeconds -= 1;
    renderFocusTimer();
    if (focusSeconds <= 0) {
      stopFocusTimer();
      focusSeconds = 25 * 60;
      renderFocusTimer();
      if (state.settings.reminders && "Notification" in window && Notification.permission === "granted") {
        new Notification("Focus block complete", { body: "Take a break or mark your task done." });
      } else {
        alert("Focus block complete. Take a break or mark your task done.");
      }
    }
  }, 1000);
}

function stopFocusTimer() {
  clearInterval(focusInterval);
  focusInterval = null;
  els.startFocus.textContent = "Start 25 min focus";
}

function renderFocusTimer() {
  const minutes = Math.floor(focusSeconds / 60);
  const seconds = focusSeconds % 60;
  els.focusTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function checkReminders() {
  if (!state.settings.reminders || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  getWeekInstances().forEach(instance => {
    if (!instance.scheduledAt || instance.notified || instance.status === "done" || instance.status === "skipped") return;
    const when = new Date(instance.scheduledAt).getTime();
    const minutesAway = (when - now) / 60000;
    if (minutesAway > 0 && minutesAway <= 5) {
      const data = modelFor(instance);
      new Notification(`Upcoming: ${data.baseTitle}`, {
        body: `${Math.round(minutesAway)} min away${data.step ? `. First step: ${data.step}` : "."}`
      });
      instance.notified = true;
      saveState();
    }
  });
}

function exportPlannerData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `focus-week-planner-${currentWeekKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importPlannerData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!imported || !Array.isArray(imported.tasks) || typeof imported.weeks !== "object") throw new Error("Invalid planner file");
      if (!confirm("Import this planner file? It will replace the planner data in this browser.")) return;
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, imported);
      normalizeState();
      ensureWeek();
      saveState();
      render();
    } catch (error) {
      alert("Could not import that file. Make sure it came from this planner.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function addLifeAdminStarterPack() {
  const starter = [
    ["Exam study", 5, 90, "high", "Study", "Highest", "Open exam plan and do the next block", "Protect this before room projects."],
    ["Note taking", 5, 45, "medium", "Study", "Highest", "Open notes/documents", "Daily or weekday study habit."],
    ["Clean notes", 3, 45, "medium", "Study", "High", "Pick one messy section", "Turn rough notes into usable revision material."],
    ["Reply to messages", 7, 10, "low", "Admin", "High", "Reply to the easiest one first", "Use as a daily admin reset."],
    ["Take out crockery", 7, 10, "low", "Daily Reset", "High", "Collect plates/cups before leaving room", "Never leave the room empty-handed."],
    ["Rubbish out", 7, 10, "low", "Daily Reset", "High", "Grab visible rubbish first", "When full, take it out immediately."],
    ["Recycling out", 2, 10, "low", "Daily Reset", "Medium", "Flatten boxes/bottles", "Do with rubbish if possible."],
    ["Make shopping list", 2, 15, "low", "Shopping", "High", "Add missing essentials", "Keep adding to it during resets."],
    ["Vacuum", 1, 30, "medium", "Cleaning", "Medium", "Clear floor first", "Weekly bigger clean."],
    ["Surfaces, mirror, windows", 1, 30, "medium", "Cleaning", "Medium", "Start with desk or mirror", "Rotate walls/windows/mirror if too much."],
    ["Room setup project", 1, 45, "medium", "Room Setup", "High", "Choose one setup action", "Food storage, makeup storage, shelves, labels, bug/noise solution."],
    ["Clothes admin", 1, 45, "medium", "Clothes", "Medium", "Pick 5 easy items", "Stock list, photos, listing, sell/upscale decisions."],
    ["Journal", 4, 10, "low", "Life Planning", "Medium", "Write three lines", "Evening low-energy close-down."],
    ["Learn keyboard", 3, 20, "medium", "Creative", "Medium", "Practice one tiny section", "Do not let it compete with exam study."],
    ["Weekly review", 1, 30, "medium", "Life Planning", "High", "Plan next week and remove clutter", "Check what to reduce during exam-heavy weeks."],
    ["Gaming/rest block", 2, 60, "low", "Rest", "Low", "Choose a stopping point first", "Reward/rest after priority blocks."]
  ];

  let added = 0;
  starter.forEach(([name, frequency, duration, energy, type, priority, step, details]) => {
    const exists = state.tasks.some(task => task.name.toLowerCase() === name.toLowerCase() && !task.archived);
    if (exists) return;
    state.tasks.push({
      id: makeId(),
      name,
      frequency,
      duration,
      energy,
      type,
      priority,
      category: type,
      step,
      details,
      archived: false,
      createdAt: new Date().toISOString()
    });
    added += 1;
  });
  ensureWeek();
  saveState();
  return added;
}

function slotMinutes() {
  const out = [];
  const start = state.settings.awakeStart * 60;
  const end = state.settings.awakeEnd * 60;
  for (let value = start; value <= end; value += state.settings.slotMinutes) out.push(value);
  return out;
}

function sortByPriority(a, b) {
  return priorityRank(modelFor(a).priority) - priorityRank(modelFor(b).priority) || modelFor(a).baseTitle.localeCompare(modelFor(b).baseTitle);
}

function priorityRank(priority) {
  return { Highest: 0, High: 1, Medium: 2, Low: 3 }[priority] ?? 2;
}

function guessType(name) {
  const value = String(name).toLowerCase();
  if (value.includes("exam") || value.includes("note")) return "Study";
  if (value.includes("rubbish") || value.includes("crockery") || value.includes("recycling")) return "Daily Reset";
  if (value.includes("vacuum") || value.includes("clean") || value.includes("surface")) return "Cleaning";
  if (value.includes("clothes") || value.includes("sell") || value.includes("stock")) return "Clothes";
  if (value.includes("gift") || value.includes("journal") || value.includes("review")) return "Life Planning";
  if (value.includes("gaming")) return "Rest";
  return "Admin";
}

function formatMinutes(minutes) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function isToday(date) {
  return isSameDate(date, new Date());
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function makeId() {
  return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(error => {
    console.info("Service worker registration skipped", error);
  });
}
