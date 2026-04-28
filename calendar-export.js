(() => {
  const PLANNER_KEYS = ["focus-week-planner-v2", "focus-week-planner-v1"];
  const EXPORT_LOG_KEY = "focus-week-planner-export-log-v1";

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

  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: true });
})();
