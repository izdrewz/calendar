(() => {
  if (window.__plannerDragCollapseLoaded) return;
  window.__plannerDragCollapseLoaded = true;

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let frame = null;
  let clickSuppressedUntil = 0;
  let styleFrame = null;
  let activeCard = null;
  let hoverTimer = null;

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
    closePopover();
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
    scheduleCalendarTaskClasses();
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

  function text(card, selector, fallback = "") {
    return card.querySelector(selector)?.textContent?.trim() || fallback;
  }

  function dataFor(card) {
    const title = text(card, "h3", card.dataset.previewTitle || "Task");
    const meta = text(card, ".task-meta", card.dataset.previewMeta || "");
    const step = text(card, ".tiny-step", "");
    const colour = getComputedStyle(card).getPropertyValue("--task-colour").trim() || "#d6a8b4";
    return { title, meta, step, colour };
  }

  function ensurePopover() {
    let pop = document.getElementById("calendarTaskPopover");
    if (pop) return pop;
    pop = document.createElement("section");
    pop.id = "calendarTaskPopover";
    pop.className = "calendar-task-popover";
    pop.hidden = true;
    pop.innerHTML = `
      <div class="calendar-task-popover-strip"></div>
      <button type="button" class="calendar-task-popover-close" aria-label="Close task preview">×</button>
      <h3></h3>
      <p class="calendar-task-popover-meta"></p>
      <p class="calendar-task-popover-step"></p>
      <div class="calendar-task-popover-actions">
        <button type="button" data-action="done">Done</button>
        <button type="button" data-action="options" class="ghost">Options</button>
        <button type="button" data-action="unplan" class="ghost">Unplan</button>
      </div>
    `;
    document.body.appendChild(pop);
    pop.querySelector(".calendar-task-popover-close").addEventListener("click", closePopover);
    pop.querySelector('[data-action="done"]').addEventListener("click", () => clickCardButton(".done-button"));
    pop.querySelector('[data-action="options"]').addEventListener("click", () => clickCardButton(".options-button,.details-button"));
    pop.querySelector('[data-action="unplan"]').addEventListener("click", () => clickCardButton(".unschedule-button"));
    return pop;
  }

  function clickCardButton(selector) {
    if (!activeCard) return;
    const button = activeCard.querySelector(selector);
    if (button) {
      button.click();
      if (!selector.includes("options") && !selector.includes("details")) closePopover();
    }
  }

  function positionPopover(card, pop) {
    const rect = card.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    const below = rect.bottom + 10;
    const above = rect.top - 10;
    pop.style.width = `${width}px`;
    pop.style.left = `${left}px`;
    if (below + 160 < window.innerHeight || above < 170) {
      pop.style.top = `${Math.min(window.innerHeight - 170, below)}px`;
      pop.style.bottom = "auto";
    } else {
      pop.style.top = "auto";
      pop.style.bottom = `${Math.max(12, window.innerHeight - above)}px`;
    }
  }

  function openPopover(card, temporary = false) {
    if (!card || isDragging || Date.now() < clickSuppressedUntil) return;
    const pop = ensurePopover();
    const data = dataFor(card);
    activeCard = card;
    document.querySelectorAll("#calendar .task-card.calendar-task-open").forEach(item => item.classList.remove("calendar-task-open"));
    card.classList.add("calendar-task-open");
    pop.querySelector("h3").textContent = data.title;
    pop.querySelector(".calendar-task-popover-meta").textContent = data.meta;
    pop.querySelector(".calendar-task-popover-step").textContent = data.step;
    pop.querySelector(".calendar-task-popover-step").hidden = !data.step;
    pop.style.setProperty("--task-colour", data.colour);
    pop.dataset.temporary = temporary ? "true" : "false";
    pop.hidden = false;
    positionPopover(card, pop);
  }

  function closePopover(force = true) {
    const pop = document.getElementById("calendarTaskPopover");
    if (!pop) return;
    if (!force && pop.dataset.temporary !== "true") return;
    pop.hidden = true;
    pop.dataset.temporary = "false";
    activeCard?.classList.remove("calendar-task-open");
    activeCard = null;
  }

  function handleCalendarClick(event) {
    const card = calendarCardFrom(event.target);
    if (!card || Date.now() < clickSuppressedUntil) return;
    event.preventDefault();
    event.stopPropagation();
    const pop = document.getElementById("calendarTaskPopover");
    if (activeCard === card && pop && !pop.hidden && pop.dataset.temporary !== "true") {
      closePopover(true);
      return;
    }
    openPopover(card, false);
  }

  function handleHover(event) {
    const card = calendarCardFrom(event.target);
    if (!card || window.matchMedia("(pointer: coarse)").matches) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => openPopover(card, true), 180);
  }

  function handleHoverOut(event) {
    const card = calendarCardFrom(event.target);
    if (!card) return;
    clearTimeout(hoverTimer);
    setTimeout(() => closePopover(false), 140);
  }

  function applyCalendarTaskClasses() {
    document.querySelectorAll("#calendar .task-card").forEach(card => {
      card.classList.add("calendar-mosaic-task");
      const data = dataFor(card);
      card.dataset.previewTitle = data.title;
      card.dataset.previewMeta = data.meta;
      card.setAttribute("title", `${data.title}${data.meta ? ` — ${data.meta}` : ""}`);
      card.tabIndex = 0;
    });
  }

  function scheduleCalendarTaskClasses() {
    if (styleFrame) return;
    styleFrame = requestAnimationFrame(() => {
      styleFrame = null;
      applyCalendarTaskClasses();
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
    if (event.target.closest?.("#calendar .task-card")) handleCalendarClick(event);
    else if (!event.target.closest?.("#calendarTaskPopover")) closePopover(true);
  }, true);

  document.addEventListener("pointerover", handleHover, true);
  document.addEventListener("pointerout", handleHoverOut, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closePopover(true);
    if ((event.key === "Enter" || event.key === " ") && document.activeElement?.matches?.("#calendar .task-card")) {
      event.preventDefault();
      openPopover(document.activeElement, false);
    }
  });

  document.addEventListener("DOMContentLoaded", scheduleCalendarTaskClasses);
  window.addEventListener("load", scheduleCalendarTaskClasses);
  document.addEventListener("drop", () => setTimeout(scheduleCalendarTaskClasses, 80), true);
  document.addEventListener("click", () => setTimeout(scheduleCalendarTaskClasses, 80), true);
  document.addEventListener("change", () => setTimeout(scheduleCalendarTaskClasses, 80), true);
})();
