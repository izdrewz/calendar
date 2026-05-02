(() => {
  if (window.__plannerDurationSlotsLoaded) return;
  window.__plannerDurationSlotsLoaded = true;

  function slotSize() {
    return Number(state?.settings?.slotMinutes || 30);
  }

  function slotStart(instance) {
    if (!instance?.scheduledAt) return null;
    const date = new Date(instance.scheduledAt);
    return date.getHours() * 60 + date.getMinutes();
  }

  function sameCalendarDay(instance, dayIndex) {
    if (!instance?.scheduledAt) return false;
    const date = new Date(instance.scheduledAt);
    const dayStart = addDays(selectedWeekStart, dayIndex);
    dayStart.setHours(0, 0, 0, 0);
    const instanceDay = new Date(date);
    instanceDay.setHours(0, 0, 0, 0);
    return instanceDay.getTime() === dayStart.getTime();
  }

  const originalScheduledForSlot = scheduledForSlot;
  scheduledForSlot = function durationScheduledForSlot(dayIndex, minutes) {
    const slot = slotSize();
    return getWeekInstances().filter(instance => {
      if (!instance.scheduledAt) return false;
      if (!sameCalendarDay(instance, dayIndex)) return false;
      const start = slotStart(instance);
      if (start === null) return false;
      const duration = Math.max(slot, Number(modelFor(instance).duration || instance.duration || slot));
      const end = start + duration;
      return Number(minutes) >= start && Number(minutes) < end;
    }).sort(sortByPriority);
  };

  const originalCreateInstanceCard = createInstanceCard;
  createInstanceCard = function durationCreateInstanceCard(instance) {
    const card = originalCreateInstanceCard(instance);
    if (instance?.scheduledAt) {
      requestAnimationFrame(() => {
        const currentSlot = Number(card.closest?.('.slot')?.dataset?.minutes || slotStart(instance));
        const start = slotStart(instance);
        const offset = start === null ? 0 : Math.max(0, currentSlot - start);
        card.dataset.durationOffset = String(offset);
        card.classList.toggle('duration-continuation', offset > 0);
        card.classList.toggle('duration-start', offset === 0);
        const data = modelFor(instance);
        if (offset > 0) card.dataset.previewTitle = `${data.baseTitle || data.title} continued`;
      });
    }
    return card;
  };

  document.addEventListener('drop', () => setTimeout(() => render(), 70), true);
})();
