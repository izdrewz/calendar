(() => {
  function readPlanner() {
    try { return JSON.parse(localStorage.getItem('focus-week-planner-v2')) || null; }
    catch { return null; }
  }

  function currentWeekKeyFromLabel() {
    const label = document.getElementById('weekLabel')?.textContent || '';
    return label;
  }

  function formatToday() {
    const target = document.getElementById('todayDateLabel');
    if (!target) return;
    const week = document.getElementById('weekLabel')?.textContent?.trim();
    const now = new Date();
    const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    target.textContent = week && week !== 'Week' ? `${today} · ${week}` : today;
  }

  function replaceStressfulProgress() {
    const progress = document.getElementById('progressText');
    if (!progress) return;
    const planner = readPlanner();
    const instances = Object.values(planner?.weeks || {}).flatMap(week => week.instances || []);
    const scheduled = instances.filter(item => item.scheduledAt && !item.deleted && item.status !== 'skipped');
    const done = scheduled.filter(item => item.status === 'done');
    progress.textContent = `${scheduled.length} scheduled${done.length ? ` · ${done.length} done` : ''}`;
  }

  function improveInjectedIcsButton() {
    const button = document.getElementById('exportCalendarIcs');
    if (!button || button.dataset.tipReady) return;
    button.classList.add('calendar-tip');
    button.dataset.tip = 'Exports only the tasks you have placed into the calendar as an .ics file you can import into another calendar app.';
    button.dataset.tipReady = 'true';
  }

  function compactCalendarAfterRender() {
    document.body.classList.add('mock-calendar-ready');
    formatToday();
    replaceStressfulProgress();
    improveInjectedIcsButton();
  }

  document.addEventListener('DOMContentLoaded', compactCalendarAfterRender);
  window.addEventListener('load', compactCalendarAfterRender);
  document.addEventListener('click', () => setTimeout(compactCalendarAfterRender, 80), true);
  document.addEventListener('drop', () => setTimeout(compactCalendarAfterRender, 120), true);
  new MutationObserver(() => requestAnimationFrame(compactCalendarAfterRender)).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
