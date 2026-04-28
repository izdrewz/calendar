(() => {
  const PLANNER_KEYS = ["focus-week-planner-v2", "focus-week-planner-v1"];
  const SESSION_KEY = "focus-week-planner-session-v1";
  const DAY_MS = 86400000;
  let activeTimerId = null;
  let timerTick = null;

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const mondayKey = date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const weekKey = () => mondayKey(new Date());

  function readPlanner() {
    for (const key of PLANNER_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) return { key, data: JSON.parse(raw) };
    }
    return { key: PLANNER_KEYS[0], data: { tasks: [], weeks: {}, settings: {} } };
  }
  function writePlanner(bundle) { localStorage.setItem(bundle.key, JSON.stringify(bundle.data)); }
  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || defaultSession(); }
    catch { return defaultSession(); }
  }
  function defaultSession() { return { dailyGoals: {}, timers: {}, logs: [], weeklyReviews: {}, backupReminders: {} }; }
  function writeSession(data) { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  function escapeHtml(value) { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function fmtSeconds(seconds = 0) {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
  }
  function getTaskName(instance, planner) {
    if (instance.title) return instance.title;
    const task = planner.tasks?.find(t => t.id === instance.taskId);
    return task ? `${task.name} ${instance.sequence || 1}/${task.frequency || 1}` : "Task";
  }
  function currentWeekInstances(planner) {
    const wk = planner.weeks?.[weekKey()] || { instances: [] };
    return (wk.instances || []).filter(i => !i.deleted);
  }
  function unfinishedInstances(planner) {
    return currentWeekInstances(planner).filter(i => i.status !== "done" && i.status !== "skipped");
  }

  function injectPanel() {
    if (document.getElementById("sessionPanel")) return;
    const panel = document.createElement("section");
    panel.id = "sessionPanel";
    panel.className = "panel session-panel";
    panel.innerHTML = `
      <div>
        <p class="eyebrow">Session tools</p>
        <h2>Today goals, timers, carryover, and review</h2>
        <p id="sessionSummary" class="hint">Loading session summary…</p>
      </div>
      <div class="session-actions">
        <button id="todayGoalsBtn" type="button">Today's goals</button>
        <button id="endSessionBtn" type="button">End session for today</button>
        <button id="weeklyReviewBtn" class="ghost" type="button">Weekly review</button>
        <button id="downloadLogsBtn" class="ghost" type="button">Download logs</button>
      </div>
    `;
    const main = document.querySelector("main.layout");
    main?.parentNode?.insertBefore(panel, main);
    document.getElementById("todayGoalsBtn").addEventListener("click", openGoalsModal);
    document.getElementById("endSessionBtn").addEventListener("click", openEndSession);
    document.getElementById("weeklyReviewBtn").addEventListener("click", openWeeklyReview);
    document.getElementById("downloadLogsBtn").addEventListener("click", downloadLogs);
    updateSummary();
  }

  function updateSummary() {
    const summary = document.getElementById("sessionSummary");
    if (!summary) return;
    const { data: planner } = readPlanner();
    const session = readSession();
    const instances = currentWeekInstances(planner);
    const done = instances.filter(i => i.status === "done").length;
    const unfinished = instances.filter(i => i.status !== "done" && i.status !== "skipped").length;
    const todayGoal = session.dailyGoals[todayKey()]?.trim();
    const todayTimed = Object.values(session.timers).filter(t => t.day === todayKey()).reduce((sum, t) => sum + (t.seconds || 0), 0);
    summary.textContent = `${done}/${instances.length} done this week • ${unfinished} unfinished • ${fmtSeconds(todayTimed)} tracked today${todayGoal ? ` • Goal: ${todayGoal.slice(0, 80)}` : ""}`;
  }

  function openModal(title, bodyHtml, onSave) {
    document.getElementById("sessionModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "sessionModal";
    modal.className = "session-modal-backdrop";
    modal.innerHTML = `
      <section class="session-modal panel" role="dialog" aria-modal="true">
        <div class="panel-heading"><div><p class="eyebrow">Planner session</p><h2>${escapeHtml(title)}</h2></div><button id="closeSessionModal" class="ghost" type="button">Close</button></div>
        <div class="session-modal-body">${bodyHtml}</div>
        <div class="session-actions"><button id="saveSessionModal" type="button">Save</button><button id="cancelSessionModal" class="ghost" type="button">Cancel</button></div>
      </section>`;
    document.body.appendChild(modal);
    document.getElementById("closeSessionModal").onclick = () => modal.remove();
    document.getElementById("cancelSessionModal").onclick = () => modal.remove();
    document.getElementById("saveSessionModal").onclick = () => { onSave?.(modal); modal.remove(); updateSummary(); };
  }

  function openGoalsModal(auto = false) {
    const session = readSession();
    const existing = session.dailyGoals[todayKey()] || "";
    openModal("Today's goals", `
      <label>What matters today?<textarea id="todayGoalsText" rows="7" placeholder="Example: revise E104 notes, take out rubbish, reply to messages…">${escapeHtml(existing)}</textarea></label>
      <p class="hint">This appears in the session summary and gets included in logs.</p>
    `, modal => {
      const data = readSession();
      data.dailyGoals[todayKey()] = modal.querySelector("#todayGoalsText").value.trim();
      data.logs.push({ at: new Date().toISOString(), type: "daily-goals", goals: data.dailyGoals[todayKey()] });
      writeSession(data);
    });
    if (auto) document.getElementById("sessionModal")?.classList.add("auto-open");
  }

  function openEndSession() {
    const bundle = readPlanner();
    const unfinished = unfinishedInstances(bundle.data);
    const rows = unfinished.map(i => `<label class="carry-row"><span>${escapeHtml(getTaskName(i, bundle.data))}</span><select data-instance="${i.id}"><option value="pile">Return to drag/drop pile</option><option value="tomorrow">Schedule tomorrow 9am</option><option value="keep">Keep as is</option><option value="skip">Mark skipped</option></select></label>`).join("") || '<p class="hint">No unfinished active tasks this week.</p>';
    openModal("End session for today", `
      <p class="hint">Choose what to do with unfinished tasks, then save. The page will reload so the planner refreshes.</p>
      <div class="carry-list">${rows}</div>
      <label>End-of-day note<textarea id="endSessionNote" rows="4" placeholder="What worked, what got stuck, what to remember tomorrow?"></textarea></label>
    `, modal => {
      const session = readSession();
      const plannerBundle = readPlanner();
      const planner = plannerBundle.data;
      const tomorrow = new Date(Date.now() + DAY_MS); tomorrow.setHours(9, 0, 0, 0);
      const week = planner.weeks?.[weekKey()];
      modal.querySelectorAll("select[data-instance]").forEach(select => {
        const instance = week?.instances?.find(i => i.id === select.dataset.instance);
        if (!instance) return;
        if (select.value === "pile") { instance.scheduledAt = null; instance.status = "unscheduled"; instance.notified = false; }
        if (select.value === "tomorrow") { instance.scheduledAt = tomorrow.toISOString(); instance.status = "scheduled"; instance.notified = false; }
        if (select.value === "skip") instance.status = "skipped";
      });
      writePlanner(plannerBundle);
      session.logs.push({ at: new Date().toISOString(), type: "end-session", note: modal.querySelector("#endSessionNote").value.trim(), unfinishedCount: unfinished.length });
      writeSession(session);
      setTimeout(() => location.reload(), 150);
    });
  }

  function openWeeklyReview() {
    const { data: planner } = readPlanner();
    const session = readSession();
    const instances = currentWeekInstances(planner);
    const countsByTask = {};
    instances.forEach(i => {
      const name = getTaskName(i, planner).replace(/ \d+\/\d+$/, "");
      countsByTask[name] ||= { done: 0, scheduled: 0, total: 0, skipped: 0, timed: 0 };
      countsByTask[name].total += 1;
      if (i.scheduledAt) countsByTask[name].scheduled += 1;
      if (i.status === "done") countsByTask[name].done += 1;
      if (i.status === "skipped") countsByTask[name].skipped += 1;
    });
    Object.values(session.timers).forEach(t => { if (mondayKey(t.updatedAt || new Date()) === weekKey()) { countsByTask[t.title] ||= { done: 0, scheduled: 0, total: 0, skipped: 0, timed: 0 }; countsByTask[t.title].timed += t.seconds || 0; } });
    const rows = Object.entries(countsByTask).map(([name, c]) => `<tr><td>${escapeHtml(name)}</td><td>${c.done}/${c.total}</td><td>${c.scheduled}</td><td>${c.skipped}</td><td>${fmtSeconds(c.timed)}</td></tr>`).join("");
    const deadlines = instances.filter(i => i.status !== "done" && i.status !== "skipped").length;
    openModal("Weekly review", `
      <p class="hint">Monday morning review: progress, unfinished tasks, habit/project counts, and tracked time.</p>
      <table class="review-table"><thead><tr><th>Task/habit/project</th><th>Done</th><th>Scheduled</th><th>Skipped</th><th>Tracked time</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No tasks this week yet.</td></tr>'}</tbody></table>
      <p class="hint">Unfinished active tasks this week: ${deadlines}</p>
      <label>Review notes<textarea id="weeklyReviewNote" rows="5" placeholder="What should carry over? What should be reduced? What is the priority this week?"></textarea></label>
    `, modal => {
      const data = readSession();
      data.weeklyReviews[weekKey()] = { at: new Date().toISOString(), note: modal.querySelector("#weeklyReviewNote").value.trim(), countsByTask };
      data.logs.push({ at: new Date().toISOString(), type: "weekly-review", week: weekKey(), countsByTask });
      writeSession(data);
    });
  }

  function injectTimerButtons() {
    document.querySelectorAll(".task-card[data-instance-id]").forEach(card => {
      const id = card.dataset.instanceId;
      const title = card.querySelector("h3")?.textContent?.replace(/ \d+\/\d+$/, "") || "Task";
      const session = readSession();
      const timer = session.timers[id] || { seconds: 0 };
      let button = card.querySelector(".task-timer-button");
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "ghost task-timer-button";
        button.addEventListener("click", event => { event.stopPropagation(); toggleTimer(id, title); });
        card.querySelector(".card-actions")?.appendChild(button);
      }
      button.textContent = `${activeTimerId === id ? "Pause" : "Timer"} ${fmtSeconds(timer.seconds)}`;

      let reset = card.querySelector(".task-timer-reset");
      if (!reset) {
        reset = document.createElement("button");
        reset.type = "button";
        reset.className = "ghost task-timer-reset";
        reset.textContent = "Reset time";
        reset.addEventListener("click", event => { event.stopPropagation(); resetTimer(id, title); });
        card.querySelector(".card-actions")?.appendChild(reset);
      }
    });
  }

  function toggleTimer(instanceId, title) {
    const session = readSession();
    session.timers[instanceId] ||= { title, seconds: 0, day: todayKey(), updatedAt: new Date().toISOString() };
    if (activeTimerId === instanceId) {
      activeTimerId = null;
      clearInterval(timerTick);
      session.logs.push({ at: new Date().toISOString(), type: "timer-pause", instanceId, title, seconds: session.timers[instanceId].seconds });
    } else {
      activeTimerId = instanceId;
      clearInterval(timerTick);
      timerTick = setInterval(() => {
        const data = readSession();
        data.timers[instanceId] ||= { title, seconds: 0, day: todayKey() };
        data.timers[instanceId].seconds += 1;
        data.timers[instanceId].title = title;
        data.timers[instanceId].day = todayKey();
        data.timers[instanceId].updatedAt = new Date().toISOString();
        writeSession(data);
        injectTimerButtons();
        updateSummary();
      }, 1000);
      session.logs.push({ at: new Date().toISOString(), type: "timer-start", instanceId, title });
    }
    writeSession(session);
    injectTimerButtons();
    updateSummary();
  }

  function resetTimer(instanceId, title) {
    const session = readSession();
    const previous = session.timers[instanceId]?.seconds || 0;
    session.timers[instanceId] = { title, seconds: 0, day: todayKey(), updatedAt: new Date().toISOString() };
    if (activeTimerId === instanceId) { activeTimerId = null; clearInterval(timerTick); }
    session.logs.push({ at: new Date().toISOString(), type: "timer-reset", instanceId, title, previousSeconds: previous });
    writeSession(session);
    injectTimerButtons();
    updateSummary();
  }

  function maybeAutoOpen() {
    const session = readSession();
    if (!session.dailyGoals[todayKey()]) setTimeout(() => openGoalsModal(true), 600);
    const now = new Date();
    if (now.getDay() === 1 && !session.weeklyReviews[weekKey()]) {
      setTimeout(() => openWeeklyReview(), 1200);
    }
    const lastBackup = session.backupReminders?.planner;
    if (!lastBackup || Date.now() - new Date(lastBackup).getTime() > 7 * DAY_MS) {
      session.backupReminders.planner = new Date().toISOString();
      writeSession(session);
      setTimeout(() => alert("Backup reminder: export your planner data this week so you do not lose tasks, logs, timers, goals, or reviews."), 1800);
    }
  }

  function downloadLogs() {
    const bundle = { planner: readPlanner().data, session: readSession(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focus-week-planner-logs-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  injectPanel();
  maybeAutoOpen();
  injectTimerButtons();
  new MutationObserver(() => { injectTimerButtons(); updateSummary(); }).observe(document.body, { childList: true, subtree: true });
})();
