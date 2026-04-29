(() => {
  const GROUP_STATE_KEY = "focus-week-planner-pile-groups-v4";
  let isGrouping = false;

  const groups = [
    { id: "uni", title: "Uni", emoji: "📚", type: "Study", terms: ["study", "exam", "note", "clean notes"] },
    { id: "self-care", title: "Self care", emoji: "🌿", type: "Daily Reset", terms: ["daily reset", "journal", "rest", "gaming", "keyboard"] },
    { id: "personal", title: "Personal", emoji: "🧾", type: "Admin", terms: ["admin", "shopping", "life planning", "gift", "messages", "reply"] },
    { id: "cleaning", title: "Cleaning", emoji: "🧽", type: "Cleaning", terms: ["cleaning", "vacuum", "surface", "mirror", "windows", "rubbish", "recycling", "crockery"] },
    { id: "projects", title: "Projects", emoji: "🧰", type: "Room Setup", terms: ["room setup", "project", "shelves", "storage", "bug", "noise", "hanger", "labels"] },
    { id: "crafts", title: "Crafts", emoji: "🎨", type: "Creative", terms: ["creative", "craft", "crochet", "dress", "upscale", "cardboard", "canderel"] },
    { id: "clothes", title: "Clothes", emoji: "👕", type: "Clothes", terms: ["clothes", "sell", "stock", "vinted", "photos", "listed"] },
    { id: "one-off", title: "One-off", emoji: "📌", type: "Admin", terms: ["one-off"] },
    { id: "other", title: "Other", emoji: "✨", type: "Admin", terms: [] }
  ];

  function readState() {
    try { return JSON.parse(localStorage.getItem(GROUP_STATE_KEY)) || { active: null }; }
    catch { return { active: null }; }
  }
  function writeState(state) { localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state)); }

  function cardText(card) {
    return [card.querySelector("h3")?.textContent, card.querySelector(".type-badge")?.textContent, card.querySelector(".task-meta")?.textContent, card.querySelector(".tiny-step")?.textContent, card.classList.contains("one-off") ? "one-off" : ""].join(" ").toLowerCase();
  }
  function groupFor(card) {
    const text = cardText(card);
    if (text.includes("one-off")) return groups.find(g => g.id === "one-off");
    return groups.find(group => group.id !== "one-off" && group.id !== "other" && group.terms.some(term => text.includes(term))) || groups.find(group => group.id === "other");
  }
  function previewText(cards) {
    if (!cards.length) return "No tasks in this box yet. Click, then Add new.";
    return cards.slice(0, 6).map(card => card.querySelector("h3")?.textContent?.trim()).filter(Boolean).join("\n") + (cards.length > 6 ? `\n+ ${cards.length - 6} more` : "");
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
    if (starter) controls.appendChild(starter);
    groups.forEach(group => {
      const cards = buckets.get(group.id) || [];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-box ${state.active === group.id ? "active" : ""}`;
      button.dataset.group = group.id;
      button.title = previewText(cards);
      button.innerHTML = `<span class="category-icon">${group.emoji}</span><span class="category-title">${group.title}</span><span class="category-count">${cards.length}</span><span class="category-preview">${previewText(cards).replaceAll("\n", "<br>")}</span>`;
      button.addEventListener("click", () => {
        const next = readState();
        next.active = next.active === group.id ? null : group.id;
        writeState(next);
        showActivePile(next.active);
      });
      controls.appendChild(button);
    });
  }

  function showActivePile(groupId) {
    document.querySelectorAll(".category-box").forEach(tab => tab.classList.toggle("active", !!groupId && tab.dataset.group === groupId));
    document.querySelectorAll(".pile-section").forEach(section => {
      const isOpen = !!groupId && section.dataset.group === groupId;
      section.hidden = !isOpen;
      section.classList.toggle("is-open", isOpen);
    });
  }
  function buildSection(group, cards) {
    const section = document.createElement("section");
    section.className = "pile-section compact-open-pile";
    section.dataset.group = group.id;
    section.hidden = true;
    section.innerHTML = `<div class="pile-section-header"><span>${group.emoji} ${group.title}</span><span>${cards.length} task${cards.length === 1 ? "" : "s"}</span><button type="button" class="ghost add-new-category">Add new</button></div><div class="pile-section-grid"></div>`;
    section.querySelector(".add-new-category").addEventListener("click", event => { event.stopPropagation(); openAddForGroup(group); });
    const grid = section.querySelector(".pile-section-grid");
    if (cards.length) cards.forEach(card => grid.appendChild(card));
    else {
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
    if (!list) return;
    const cards = [...list.querySelectorAll(":scope > .task-card, :scope .pile-section-grid > .task-card")];
    if (!cards.length && list.classList.contains("pile-list")) return;
    isGrouping = true;
    const buckets = new Map(groups.map(group => [group.id, []]));
    cards.forEach(card => buckets.get(groupFor(card).id).push(card));
    makeControls(list, buckets);
    list.innerHTML = "";
    list.className = "card-list pile-list compact-pile-list";
    groups.forEach(group => list.appendChild(buildSection(group, buckets.get(group.id) || [])));
    showActivePile(readState().active);
    isGrouping = false;
  }
  function scheduleGrouping() { window.setTimeout(groupPiles, 60); }
  document.addEventListener("DOMContentLoaded", scheduleGrouping);
  window.addEventListener("load", scheduleGrouping);
  document.addEventListener("submit", scheduleGrouping, true);
  document.addEventListener("click", event => { if (event.target.closest("button") || event.target.closest(".task-card") || event.target.closest(".slot")) scheduleGrouping(); }, true);
  document.addEventListener("drop", scheduleGrouping, true);
})();
