(() => {
  const PLANNER_KEYS = ["focus-week-planner-v2", "focus-week-planner-v1"];
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
    return task ? `${task.name} ${instance.sequence || 1}/${task.frequency || 1}` : "Planned task";
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
    Object.values(planner.weeks || {}).forEach(week => {
      (week.instances || []).forEach(instance => {
        if (!instance.scheduledAt || instance.deleted || instance.status === "skipped") return;
        const start = new Date(instance.scheduledAt);
        const duration = Number(instance.duration || taskFor(planner, instance.taskId)?.duration || 30);
        events.push({ instance, start, end: new Date(start.getTime() + duration * 60000) });
      });
    });
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Focus Week Planner//Safe Export//EN", "CALSCALE:GREGORIAN"];
    events.forEach(({ instance, start, end }) => {
      const task = taskFor(planner, instance.taskId);
      const description = [
        task?.type || instance.type ? `Type: ${task?.type || instance.type}` : "",
        task?.priority || instance.priority ? `Priority: ${task?.priority || instance.priority}` : "",
        task?.step || instance.step ? `First step: ${task?.step || instance.step}` : "",
        task?.details || instance.details || instance.note ? `Details: ${task?.details || instance.details || instance.note}` : ""
      ].filter(Boolean).join("\\n");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${escapeIcs(instance.id || crypto.randomUUID())}@focus-week-planner`);
      lines.push(`DTSTAMP:${icsDate(new Date())}`);
      lines.push(`DTSTART:${icsDate(start)}`);
      lines.push(`DTEND:${icsDate(end)}`);
      lines.push(`SUMMARY:${escapeIcs(titleFor(planner, instance))}`);
      if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return { ics: lines.join("\r\n"), count: events.length };
  }
  function downloadIcs() {
    const { ics, count } = buildIcs();
    if (!count) return alert("No scheduled tasks found to export yet. Drag tasks onto the calendar first.");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `focus-week-planner-${new Date().toISOString().slice(0, 10)}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function inject() {
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
  document.addEventListener("DOMContentLoaded", inject);
  window.addEventListener("load", inject);
})();
