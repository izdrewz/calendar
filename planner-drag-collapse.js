(() => {
  if (window.__plannerDragCollapseLoaded) return;
  window.__plannerDragCollapseLoaded = true;

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let frame = null;
  let clickSuppressedUntil = 0;

  function clampSpeed(distance, edge) {
    const amount = Math.max(0, edge - distance);
    return Math.min(24, Math.max(4, Math.round(amount / 3)));
  }

  function scrollWindowNearEdges() {
    const edge = 82;
    let dx = 0;
    let dy = 0;
    if (lastX < edge) dx = -clampSpeed(lastX, edge);
    if (window.innerWidth - lastX < edge) dx = clampSpeed(window.innerWidth - lastX, edge);
    if (lastY < edge) dy = -clampSpeed(lastY, edge);
    if (window.innerHeight - lastY < edge) dy = clampSpeed(window.innerHeight - lastY, edge);
    if (dx || dy) window.scrollBy({ left: dx, top: dy, behavior: "auto" });
  }

  function scrollElementNearEdges(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (lastX < rect.left || lastX > rect.right || lastY < rect.top || lastY > rect.bottom) return;

    const edge = 64;
    let dx = 0;
    let dy = 0;
    const leftDistance = lastX - rect.left;
    const rightDistance = rect.right - lastX;
    const topDistance = lastY - rect.top;
    const bottomDistance = rect.bottom - lastY;

    if (leftDistance < edge) dx = -clampSpeed(leftDistance, edge);
    if (rightDistance < edge) dx = clampSpeed(rightDistance, edge);
    if (topDistance < edge) dy = -clampSpeed(topDistance, edge);
    if (bottomDistance < edge) dy = clampSpeed(bottomDistance, edge);

    if (dx || dy) element.scrollBy({ left: dx, top: dy, behavior: "auto" });
  }

  function tick() {
    if (!isDragging) {
      frame = null;
      return;
    }
    scrollWindowNearEdges();
    document.querySelectorAll(".mock-calendar-box, .pile-section-grid, #unscheduledList, .category-box-row").forEach(scrollElementNearEdges);
    frame = requestAnimationFrame(tick);
  }

  function startDrag(event) {
    isDragging = true;
    clickSuppressedUntil = Date.now() + 450;
    lastX = event.clientX || lastX;
    lastY = event.clientY || lastY;
    document.body.classList.add("is-dragging-task");
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function stopDrag() {
    isDragging = false;
    clickSuppressedUntil = Date.now() + 260;
    document.body.classList.remove("is-dragging-task");
  }

  function updatePointer(event) {
    if (!isDragging) return;
    lastX = event.clientX || lastX;
    lastY = event.clientY || lastY;
  }

  function calendarCardFrom(target) {
    const card = target.closest?.("#calendar .task-card");
    if (!card) return null;
    if (target.closest("button, select, input, textarea, label, a")) return null;
    return card;
  }

  function toggleCalendarCard(event) {
    if (Date.now() < clickSuppressedUntil) return;
    const card = calendarCardFrom(event.target);
    if (!card) return;
    if (document.body.classList.contains("day-focus")) return;
    event.preventDefault();
    event.stopPropagation();
    card.classList.toggle("calendar-task-open");
  }

  function collapseOtherCards(event) {
    const card = calendarCardFrom(event.target);
    if (!card || event.shiftKey) return;
    document.querySelectorAll("#calendar .task-card.calendar-task-open").forEach(open => {
      if (open !== card) open.classList.remove("calendar-task-open");
    });
  }

  function applyCalendarTaskClasses() {
    document.querySelectorAll("#calendar .task-card").forEach(card => {
      card.classList.add("calendar-mosaic-task");
      if (!card.dataset.previewTitle) {
        const title = card.querySelector("h3")?.textContent?.trim() || "Task";
        const meta = card.querySelector(".task-meta")?.textContent?.trim() || "";
        card.dataset.previewTitle = title;
        card.dataset.previewMeta = meta;
        card.setAttribute("title", `${title}${meta ? ` — ${meta}` : ""}`);
      }
    });
  }

  document.addEventListener("dragstart", event => {
    if (event.target.closest?.(".task-card")) startDrag(event);
  }, true);

  document.addEventListener("dragover", updatePointer, true);
  document.addEventListener("drag", updatePointer, true);
  document.addEventListener("drop", stopDrag, true);
  document.addEventListener("dragend", stopDrag, true);
  document.addEventListener("pointercancel", stopDrag, true);

  document.addEventListener("click", event => {
    collapseOtherCards(event);
    toggleCalendarCard(event);
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("#calendar .task-card.calendar-task-open").forEach(card => card.classList.remove("calendar-task-open"));
  });

  new MutationObserver(() => requestAnimationFrame(applyCalendarTaskClasses)).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", applyCalendarTaskClasses);
  window.addEventListener("load", applyCalendarTaskClasses);
  setInterval(applyCalendarTaskClasses, 900);
})();
