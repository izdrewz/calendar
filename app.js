const STORAGE_KEY = "focus-week-planner-v1";
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
  taskCategory: document.getElementById("taskCategory"),
  taskStep: document.getElementById("taskStep"),
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
      id: crypto.randomUUID(),
      name: els.taskName.value.trim(),
      frequency: clamp(Number(els.taskFrequency.value), 1, 14),
      duration: clamp(Number(els.taskDuration.value), 5, 360),
      energy: els.taskEnergy.value,
      category: els.taskCategory.value.trim(),
      step: els.taskStep.value.trim(),
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
    const raw = localStorage.getItem(STORAGE_KEY);
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
        id: crypto.randomUUID(),
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
  els.progressText.textContent = `${scheduled}/${instances.length} scheduled • ${done}/${instances.length} done`;
}

function renderUnscheduled() {
  els.unscheduledList.innerHTML = "";
  const items = getWeekInstances().filter(instance => !instance.scheduledAt && instance.status !== "done" && instance.status !== "skipped");
  els.unscheduledCount.textContent = String(items.length);
  items.forEach(instance => els.unscheduledList.appendChild(createInstanceCard(instance)));
}

function renderTaskLibrary() {
  els.taskLibrary.innerHTML = "";
  const tasks = state.tasks.filter(task => !task.archived);
  if (!tasks.length) {
    els.taskLibrary.innerHTML = `<p class="hint">Add one rule above. Example: “Study”, 3× per week, 45 minutes.</p>`;
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement("article");
    card.className = "rule-card";
    const instances = getWeekInstances().filter(instance => instance.taskId === task.id && !instance.deleted);
    const placed = instances.filter(instance => instance.scheduledAt).length;
    card.innerHTML = `
      <h3>${escapeHtml(task.name)}</h3>
      <p>${task.frequency}× weekly • ${task.duration} min • ${escapeHtml(task.energy)} energy${task.category ? ` • ${escapeHtml(task.category)}` : ""}</p>
      <p>${placed}/${instances.length} placed this week</p>
      <div class="rule-actions">
        <button type="button" class="ghost" data-action="add-instance">+1 this week</button>
        <button type="button" class="ghost" data-action="edit-frequency">Change ×/week</button>
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
    id: crypto.randomUUID(),
    taskId: task.id,
    sequence: count + 1,
    weekKey: currentWeekKey(),
    scheduledAt: null,
    duration: task.duration,
    status: "unscheduled",
    note: "",
    notified: false,
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
  }).sort((a, b) => (getTask(a.taskId)?.name || "").localeCompare(getTask(b.taskId)?.name || ""));
}

function createInstanceCard(instance) {
  const task = getTask(instance.taskId);
  const card = els.cardTemplate.content.firstElementChild.cloneNode(true);
  const title = task ? `${task.name} ${instance.sequence}/${task.frequency}` : "Missing task";
  const duration = instance.duration || task?.duration || 30;
  card.dataset.instanceId = instance.id;
  card.classList.toggle("selected", selectedInstanceId === instance.id);
  card.classList.toggle("done", instance.status === "done");
  card.classList.toggle("skipped", instance.status === "skipped");
  card.querySelector("h3").textContent = title;
  card.querySelector(".task-meta").textContent = [
    `${duration} min`,
    task?.energy || "medium",
    task?.category || "",
    instance.scheduledAt ? formatDateTime(new Date(instance.scheduledAt)) : "not planned"
  ].filter(Boolean).join(" • ");
  card.querySelector(".tiny-step").textContent = task?.step ? `First step: ${task.step}` : "";
  card.querySelector(".status-dot").classList.add(task?.energy || "medium");

  card.addEventListener("dragstart", event => {
    selectedInstanceId = instance.id;
    event.dataTransfer.setData("text/plain", instance.id);
    event.dataTransfer.effectAllowed = "move";
    render();
  });

  card.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    selectedInstanceId = selectedInstanceId === instance.id ? null : instance.id;
    render();
  });

  card.querySelector(".done-button").addEventListener("click", () => {
    instance.status = instance.status === "done" ? "scheduled" : "done";
    saveState();
    render();
  });

  card.querySelector(".skip-button").addEventListener("click", () => {
    instance.status = instance.status === "skipped" ? "scheduled" : "skipped";
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
    .map(instance => ({ instance, when: new Date(instance.scheduledAt), task: getTask(instance.taskId) }))
    .filter(item => isSameDate(item.when, now))
    .sort((a, b) => a.when - b.when);
  const next = todayInstances.find(item => item.when >= now) || todayInstances[0];

  if (!next) {
    const unplanned = getWeekInstances().find(instance => !instance.scheduledAt && instance.status === "unscheduled");
    els.focusTitle.textContent = unplanned ? "Pick one small thing" : "Today focus";
    els.focusText.textContent = unplanned
      ? `Try placing "${getTask(unplanned.taskId)?.name || "a task"}" somewhere today.`
      : "Nothing left for today. Nice.";
    return;
  }

  els.focusTitle.textContent = next.task?.name || "Next task";
  els.focusText.textContent = `${formatDateTime(next.when)} • ${next.instance.duration || next.task?.duration || 30} min${next.task?.step ? ` • First step: ${next.task.step}` : ""}`;
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
      const task = getTask(instance.taskId);
      new Notification(`Upcoming: ${task?.name || "Task"}`, {
        body: `${Math.round(minutesAway)} min away${task?.step ? `. First step: ${task.step}` : "."}`
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

function slotMinutes() {
  const out = [];
  const start = state.settings.awakeStart * 60;
  const end = state.settings.awakeEnd * 60;
  for (let value = start; value <= end; value += state.settings.slotMinutes) out.push(value);
  return out;
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
