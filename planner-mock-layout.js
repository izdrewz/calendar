(() => {
  function formatToday() {
    const target = document.getElementById('todayDateLabel');
    if (!target) return;
    const now = new Date();
    target.textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function compactCalendarAfterRender() {
    document.body.classList.add('mock-calendar-ready');
  }

  document.addEventListener('DOMContentLoaded', () => {
    formatToday();
    compactCalendarAfterRender();
  });
})();
