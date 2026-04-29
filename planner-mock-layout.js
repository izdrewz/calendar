(() => {
  const CATEGORY_COLOURS = [
    { key: 'Study|Uni|exam|note', name: 'uni', colour: '#7d99c8' },
    { key: 'Daily Reset|Self care|journal|rest|gaming|keyboard', name: 'self-care', colour: '#b5cf48' },
    { key: 'Admin|Personal|shopping|gift|messages|reply', name: 'personal', colour: '#d792a8' },
    { key: 'Cleaning|cleaning|vacuum|surface|mirror|rubbish|recycling|crockery', name: 'cleaning', colour: '#91c1e6' },
    { key: 'Room Setup|Projects|shelves|storage|bug|noise|labels', name: 'projects', colour: '#8f2a51' },
    { key: 'Creative|Crafts|crochet|dress|upscale|cardboard|canderel', name: 'crafts', colour: '#c17aa0' },
    { key: 'Clothes|clothes|sell|stock|vinted|photos', name: 'clothes', colour: '#6f173c' },
    { key: 'one-off|One-off', name: 'one-off', colour: '#e0a437' },
    { key: 'Other', name: 'other', colour: '#9b8094' }
  ];

  function categoryForCard(card) {
    const text = [
      card.querySelector('h3')?.textContent,
      card.querySelector('.type-badge')?.textContent,
      card.querySelector('.task-meta')?.textContent,
      card.querySelector('.tiny-step')?.textContent,
      card.classList.contains('one-off') ? 'one-off' : ''
    ].join(' ').toLowerCase();
    return CATEGORY_COLOURS.find(item => item.key.toLowerCase().split('|').some(term => text.includes(term))) || CATEGORY_COLOURS[CATEGORY_COLOURS.length - 1];
  }

  function formatToday() {
    const dateTarget = document.getElementById('currentDateText');
    const weekTarget = document.getElementById('headerWeekRange');
    const singleTarget = document.getElementById('todayDateLabel');
    const week = document.getElementById('weekLabel')?.textContent?.trim();
    const now = new Date();
    const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    if (dateTarget && weekTarget) {
      dateTarget.textContent = today;
      weekTarget.textContent = week && week !== 'Week' ? week : '';
      return;
    }
    if (singleTarget) singleTarget.textContent = week && week !== 'Week' ? `${today}\n${week}` : today;
  }

  function styleTaskCards() {
    document.querySelectorAll('.task-card').forEach(card => {
      const category = categoryForCard(card);
      card.dataset.category = category.name;
      card.style.setProperty('--task-colour', category.colour);
      const dot = card.querySelector('.status-dot');
      if (dot) dot.style.background = category.colour;
    });
  }

  function replaceStressfulProgress() {
    const progress = document.getElementById('progressText');
    const fill = document.getElementById('calendarProgressFill');
    if (!progress && !fill) return;
    const scheduledCards = [...document.querySelectorAll('#calendar .task-card')].filter(card => !card.classList.contains('skipped'));
    const scheduled = scheduledCards.length;
    const done = scheduledCards.filter(card => card.classList.contains('done')).length;
    const percent = scheduled ? Math.round((done / scheduled) * 100) : 0;
    if (progress) progress.textContent = scheduled ? `${done} done of ${scheduled} scheduled` : '0 scheduled';
    if (fill) fill.style.width = `${percent}%`;
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
    styleTaskCards();
    replaceStressfulProgress();
    improveInjectedIcsButton();
  }

  document.addEventListener('DOMContentLoaded', compactCalendarAfterRender);
  window.addEventListener('load', compactCalendarAfterRender);
  document.addEventListener('click', () => setTimeout(compactCalendarAfterRender, 80), true);
  document.addEventListener('drop', () => setTimeout(compactCalendarAfterRender, 120), true);
  new MutationObserver(() => requestAnimationFrame(compactCalendarAfterRender)).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
})();
