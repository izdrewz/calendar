(() => {
  const PLANNER_KEYS = ["focus-week-planner-v2", "focus-week-planner-v1"];
  const EXPORT_LOG_KEY = "focus-week-planner-export-log-v1";
  const GROUP_STATE_KEY = "focus-week-planner-unscheduled-groups-v1";
  let groupingNow = false;

  function readPlanner() {
    for (const key of PLANNER_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
    return { tasks: [], weeks: {} };
  }

  function taskFor(planner, taskId) {
    return planner.tasks?.find(task => task.id === taskId);
  }

  function titleFor(planner, instance) {
    if (instance.title) return instance.title;
    const task = taskFor(planner, instance.taskId);
    if (!task) return "Planned task";
    return `${task.name} ${instance.sequence || 1}/${task.frequency || 1}`;
  }

  function detailsFor(planner, instance) {
    const task = taskFor(planner, instance.taskId);
    const parts = [];
    if (task?.type || instance.type) parts.push(`Type: ${task?.type || instance.type}`);
    if (task?.priority || instance.priority) parts.push(`Priority: ${task?.priority || instance.priority}`);
    if (task?.step || instance.step) parts.push(`First step: ${task?.step || instance.step}`);
    if (task?.details || instance.details || instance.note) parts.push(`Details: ${task?.details || instance.details || instance.note}`);
    return parts.join("\\n");
  }

  function pad(value) { return String(value).padStart(2, "0"); }
  function icsDate(date) {
    const d = new Date(date);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }
  function escapeIcs(value) {
    return String(value || "").replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
  }

  function buildIcs() {
    const planner = readPlanner();
    const events = [];
    Object.entries(planner.weeks || {}).forEach(([weekKey, week]) => {
      (week.instances || []).forEach(instance => {
        if (!instance.scheduledAt || instance.deleted || instance.status === "skipped") return;
        const start = new Date(instance.scheduledAt);
        const duration = Number(instance.duration || taskFor(planner, instance.taskId)?.duration || 30);
        const end = new Date(start.getTime() + duration * 60000);
        events.push({
          uid: `${instance.id || crypto.randomUUID()}@focus-week-planner`,
          start,
          end,
          title: titleFor(planner, instance),
          description: detailsFor(planner, instance),
          weekKey
        });
      });
    });

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Focus Week Planner//Calendar Export//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];
    events.forEach(event => {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${escapeIcs(event.uid)}`);
      lines.push(`DTSTAMP:${icsDate(new Date())}`);
      lines.push(`DTSTART:${icsDate(event.start)}`);
      lines.push(`DTEND:${icsDate(event.end)}`);
      lines.push(`SUMMARY:${escapeIcs(event.title)}`);
      if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return { ics: lines.join("\r\n"), count: events.length };
  }

  function downloadIcs() {
    const { ics, count } = buildIcs();
    if (!count) {
      alert("No scheduled tasks found to export yet. Drag tasks onto the calendar first.");
      return;
    }
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focus-week-planner-${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(EXPORT_LOG_KEY, new Date().toISOString());
    alert(`Exported ${count} scheduled task(s) as a calendar file.`);
  }

  function injectButton() {
    if (document.getElementById("exportCalendarIcs")) return;
    const target = document.querySelector(".toolbar .toggles") || document.querySelector(".header-actions");
    if (!target) return;
    const button = document.createElement("button");
    button.id = "exportCalendarIcs";
    button.className = "ghost";
    button.type = "button";
    button.textContent = "Export calendar .ics";
    button.addEventListener("click", downloadIcs);
    target.appendChild(button);
  }

  const groups = [
    { id: "uni", title: "Uni / study", emoji: "📚", matches: ["study", "exam", "note", "clean notes"] },
    { id: "self-care", title: "Self care / reset", emoji: "🌿", matches: ["daily reset", "rest", "journal", "gaming"] },
    { id: "personal", title: "Personal / admin", emoji: "🧾", matches: ["admin", "shopping", "life planning", "gift", "messages"] },
    { id: "cleaning", title: "Cleaning", emoji: "🧽", matches: ["cleaning", "vacuum", "surface", "mirror", "windows"] },
    { id: "projects", title: "Projects / room setup", emoji: "🧰", matches: ["room setup", "project", "shelves", "storage", "bug", "noise"] },
    { id: "crafts", title: "Crafts / creative", emoji: "🎨", matches: ["creative", "craft", "crochet", "keyboard", "dress", "upscale"] },
    { id: "clothes", title: "Clothes", emoji: "👕", matches: ["clothes", "sell", "stock", "vinted", "upscale"] },
    { id: "one-off", title: "One-off / temporary", emoji: "📌", matches: ["one-off"] },
    { id: "other", title: "Other", emoji: "✨", matches: [] }
  ];

  function readGroupState() {
    try { return JSON.parse(localStorage.getItem(GROUP_STATE_KEY)) || {}; }
    catch { return {}; }
  }
  function writeGroupState(value) {
    localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(value));
  }
  function textOf(card) {
    return [
      card.querySelector("h3")?.textContent,
      card.querySelector(".type-badge")?.textContent,
      card.querySelector(".task-meta")?.textContent,
      card.querySelector(".tiny-step")?.textContent,
      card.classList.contains("one-off") ? "one-off" : ""
    ].join(" ").toLowerCase();
  }
  function groupFor(card) {
    const text = textOf(card);
    if (text.includes("one-off")) return groups.find(group => group.id === "one-off");
    return groups.find(group => group.id !== "one-off" && group.id !== "other" && group.matches.some(match => text.includes(match))) || groups.find(group => group.id === "other");
  }

  function groupUnscheduledPile() {
    if (groupingNow) return;
    const list = document.getElementById("unscheduledList");
    if (!list) return;
    const directCards = [...list.children].filter(child => child.classList?.contains("task-card"));
    if (!directCards.length) return;

    groupingNow = true;
    const collapsed = readGroupState();
    const buckets = new Map(groups.map(group => [group.id, []]));
    directCards.forEach(card => buckets.get(groupFor(card).id).push(card));

    list.innerHTML = "";
    list.classList.add("grouped-unscheduled-list");

    groups.forEach(group => {
      const cards = buckets.get(group.id) || [];
      if (!cards.length) return;
      const section = document.createElement("section");
      section.className = "task-group-section";
      section.dataset.group = group.id;
      const isClosed = Boolean(collapsed[group.id]);
      section.innerHTML = `
        <button class="task-group-header" type="button" aria-expanded="${String(!isClosed)}">
          <span><span class="task-group-emoji">${group.emoji}</span>${group.title}</span>
          <span class="task-group-count">${cards.length}</span>
        </button>
        <div class="task-group-cards" ${isClosed ? "hidden" : ""}></div>
      `;
      const body = section.querySelector(".task-group-cards");
      cards.forEach(card => body.appendChild(card));
      section.querySelector(".task-group-header").addEventListener("click", () => {
        const next = !body.hidden;
        body.hidden = next;
        section.querySelector(".task-group-header").setAttribute("aria-expanded", String(!next));
        const state = readGroupState();
        state[group.id] = next;
        writeGroupState(state);
      });
      list.appendChild(section);
    });
    groupingNow = false;
  }

  function injectGroupControls() {
    const list = document.getElementById("unscheduledList");
    if (!list || document.getElementById("taskGroupControls")) return;
    const controls = document.createElement("div");
    controls.id = "taskGroupControls";
    controls.className = "task-group-controls";
    controls.innerHTML = `
      <button type="button" class="ghost" data-open-groups>Open all</button>
      <button type="button" class="ghost" data-close-groups>Collapse all</button>
    `;
    list.parentElement?.insertBefore(controls, list);
    controls.querySelector("[data-open-groups]").addEventListener("click", () => {
      writeGroupState({});
      document.querySelectorAll(".task-group-cards").forEach(body => body.hidden = false);
      document.querySelectorAll(".task-group-header").forEach(header => header.setAttribute("aria-expanded", "true"));
    });
    controls.querySelector("[data-close-groups]").addEventListener("click", () => {
      const state = Object.fromEntries(groups.map(group => [group.id, true]));
      writeGroupState(state);
      document.querySelectorAll(".task-group-cards").forEach(body => body.hidden = true);
      document.querySelectorAll(".task-group-header").forEach(header => header.setAttribute("aria-expanded", "false"));
    });
  }

  function enhanceTaskPile() {
    injectGroupControls();
    groupUnscheduledPile();
  }

  injectButton();
  enhanceTaskPile();
  new MutationObserver(() => {
    injectButton();
    enhanceTaskPile();
  }).observe(document.body, { childList: true, subtree: true });
})();
