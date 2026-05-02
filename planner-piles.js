(() => {
  const GROUP_STATE_KEY = "focus-week-planner-pile-groups-v9";
  let isGrouping = false;
  let groupFrame = null;

  const groups = [
    { id: "uni", title: "Uni", colour: "#3f78b5", type: "Study", terms: ["study", "uni", "exam", "note", "clean notes"] },
    { id: "self-care", title: "Self care", colour: "#7fa84b", type: "Daily Reset", terms: ["daily reset", "self care", "journal", "rest", "gaming", "keyboard"] },
    { id: "personal", title: "Personal", colour: "#d85f7b", type: "Admin", terms: ["admin", "personal", "shopping", "life planning", "gift", "messages", "reply"] },
    { id: "cleaning", title: "Cleaning", colour: "#45a9bd", type: "Cleaning", terms: ["cleaning", "vacuum", "surface", "mirror", "windows", "rubbish", "recycling", "crockery"] },
    { id: "projects", title: "Projects", colour: "#c02f36", type: "Room Setup", terms: ["room setup", "project", "projects", "shelves", "storage", "bug", "noise", "hanger", "labels"] },
    { id: "creativity", title: "Creativity", colour: "#a85aa0", type: "Creative", terms: ["creative", "creativity", "craft", "crafts", "crochet", "dress", "upscale", "cardboard", "canderel"] },
    { id: "clothes", title: "Clothes", colour: "#77824f", type: "Clothes", terms: ["clothes", "sell", "stock", "vinted", "photos", "listed"] },
    { id: "one-off", title: "One-off", colour: "#b9742f", type: "Admin", terms: ["one-off", "one off"] },
    { id: "other", title: "Other", colour: "#4f2441", type: "Admin", terms: [] }
  ];

  const starterGuide = [
    "Starter setup guide:",
    "1. Click a category to open its task tray.",
    "2. Drag a card into a calendar time slot to copy it there.",
    "3. Use Options on a card to change intensity, details, or category.",
    "4. Click a date header to focus on one day.",
    "5. Use the gold corner box to open full calendar mode."
  ].join("\n");

  function readState() {
    try { return JSON.parse(localStorage.getItem(GROUP_STATE_KEY)) || { active: null }; }
    catch { return { active: null }; }
  }
  function writeState(state) { localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state)); }

  function textForData(data) {
    return [data.type, data.category, data.baseTitle, data.title, data.step, data.details, data.isOneOff ? "one-off" : ""].join(" ").toLowerCase();
  }

  function groupForData(data) {
    const text = textForData(data);
    if (text.includes("one-off") || text.includes("one off")) return groups.find(g => g.id === "one-off");
    return groups.find(group => group.id !== "one-off" && group.id !== "other" && group.terms.some(term => text.includes(term))) || groups.find(group => group.id === "other");
  }

  function getUnscheduledInstances() {
    if (typeof getWeekInstances !== "function" || typeof modelFor !== "function") return [];
    return getWeekInstances()
      .filter(instance => !instance.scheduledAt && instance.status !== "done" && instance.status !== "skipped")
      .sort(typeof sortByPriority === "function" ? sortByPriority : () => 0);
  }

  function previewText(items, group) {
    if (!items.length) return `${group.title}: no tasks yet. Click this box, then Add new.`;
    const examples = items.slice(0, 4).map(item => modelFor(item).baseTitle || modelFor(item).title).filter(Boolean).join("\n");
    return `${group.title}: ${items.length} task${items.length === 1 ? "" : "s"}.\n${examples}`;
  }

  function openAddForGroup(group) {
    const weekly = document.getElementById("weeklyAddPanel");
    const oneOff = document.getElementById("oneOffAddPanel");
    const typeSelect = document.getElementById("taskType");
    const categoryInput = document.getElementById("taskCategory");
    const oneOffType = document.getElementById("oneOffType");
    if (group.id === "one-off") {
      if (weekly) weekly.open = false;
      if (oneOff) oneOff.open = true;
      if (oneOffType) oneOffType.value = group.type;
      oneOff?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("oneOffName")?.focus();
      return;
    }
    if (oneOff) oneOff.open = false;
    if (weekly) weekly.open = true;
    if (typeSelect) typeSelect.value = group.type;
    if (categoryInput) categoryInput.value = group.title.toLowerCase();
    weekly?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("taskName")?.focus();
  }

  function addDragHint(card, group) {
    card.dataset.categoryGroup = group.id;
    card.style.setProperty("--task-colour", group.colour);
    card.setAttribute("draggable", "true");
    const oldHelper = card.querySelector(".drag-helper-label");
    if (oldHelper) oldHelper.remove();
    const meta = card.querySelector(".task-meta");
    if (meta && !meta.dataset.expandedLabel) {
      meta.dataset.expandedLabel = "true";
      meta.innerHTML = meta.textContent.replace(/(\d+)\/(\d+)/g, "copy $1 of $2");
    }
  }

  function makeBuckets(items) {
    const buckets = new Map(groups.map(group => [group.id, []]));
    items.forEach(instance => {
      const data = modelFor(instance);
      buckets.get(groupForData(data).id).push(instance);
    });
    return buckets;
  }

  function makeControls(list, buckets) {
    const state = readState();
    let controls = document.getElementById("pileGroupTabs");
    if (!controls) {
      controls = document.createElement("div");
      controls.id = "pileGroupTabs";
      controls.className = "category-box-row";
      list.parentElement?.insertBefore(controls, list);
    }
    const starter = document.getElementById("loadStarter");
    controls.innerHTML = "";
    if (starter) {
      starter.title = starterGuide;
      starter.querySelector(".category-preview")?.remove();
      const preview = document.createElement("span");
      preview.className = "category-preview starter-guide-preview";
      preview.innerHTML = starterGuide.replaceAll("\n", "<br>");
      starter.appendChild(preview);
      controls.appendChild(starter);
    }
    groups.forEach(group => {
      const items = buckets.get(group.id) || [];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-box ${state.active === group.id ? "active" : ""}`;
      button.dataset.group = group.id;
      button.style.setProperty("--category-colour", group.colour);
      button.title = previewText(items, group);
      button.innerHTML = `<span class="category-dot" style="--dot:${group.colour}"></span><span class="category-title">${group.title}</span><span class="category-count">${items.length}</span><span class="category-preview">${previewText(items, group).replaceAll("\n", "<br>")}</span>`;
      button.addEventListener("click", () => {
        const next = readState();
        next.active = next.active === group.id ? null : group.id;
        writeState(next);
        groupPiles();
      });
      controls.appendChild(button);
    });
  }

  function buildSection(group, items, activeGroup) {
    const section = document.createElement("section");
    section.className = `pile-section compact-open-pile clear-drag-tray ${activeGroup === group.id ? "is-open" : ""}`;
    section.dataset.group = group.id;
    section.hidden = activeGroup !== group.id;
    section.style.setProperty("--task-colour", group.colour);
    section.innerHTML = `<div class="pile-section-header"><span><span class="inline-dot" style="--dot:${group.colour}"></span>${group.title}</span><span>${items.length} card${items.length === 1 ? "" : "s"}</span><button type="button" class="ghost add-new-category">Add new</button></div><div class="pile-section-grid"></div>`;
    section.querySelector(".add-new-category").addEventListener("click", event => { event.stopPropagation(); openAddForGroup(group); });
    const grid = section.querySelector(".pile-section-grid");
    if (items.length) {
      items.forEach(instance => {
        const card = createInstanceCard(instance);
        addDragHint(card, group);
        grid.appendChild(card);
      });
    } else {
      const empty = document.createElement("p");
      empty.className = "empty-category-note";
      empty.textContent = "No tasks yet. Click Add new.";
      grid.appendChild(empty);
    }
    return section;
  }

  function groupPiles() {
    if (isGrouping) return;
    const list = document.getElementById("unscheduledList");
    if (!list || typeof createInstanceCard !== "function") return;
    isGrouping = true;
    const activeGroup = readState().active;
    const items = getUnscheduledInstances();
    const buckets = makeBuckets(items);
    makeControls(list, buckets);
    list.innerHTML = "";
    list.className = "card-list pile-list compact-pile-list";
    if (activeGroup) {
      const group = groups.find(item => item.id === activeGroup) || groups[0];
      list.appendChild(buildSection(group, buckets.get(group.id) || [], activeGroup));
    }
    const count = document.getElementById("unscheduledCount");
    if (count) count.textContent = String(items.length);
    isGrouping = false;
  }

  function scheduleGrouping() {
    if (groupFrame) return;
    groupFrame = requestAnimationFrame(() => {
      groupFrame = null;
      groupPiles();
    });
  }

  document.addEventListener("DOMContentLoaded", scheduleGrouping);
  window.addEventListener("load", scheduleGrouping);
  document.addEventListener("submit", () => setTimeout(scheduleGrouping, 80), true);
  document.addEventListener("drop", () => setTimeout(scheduleGrouping, 140), true);
  document.addEventListener("click", event => {
    if (event.target.closest("#pileGroupTabs,.task-card,.slot,#prevWeek,#nextWeek,#todayWeek,.card-actions")) setTimeout(scheduleGrouping, 120);
  }, true);
})();
