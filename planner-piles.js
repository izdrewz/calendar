(() => {
  const GROUP_STATE_KEY = "focus-week-planner-pile-groups-v2";
  let isGrouping = false;

  const groups = [
    { id: "uni", title: "Uni / study", emoji: "📚", terms: ["study", "exam", "note", "clean notes"] },
    { id: "self-care", title: "Self care / reset", emoji: "🌿", terms: ["daily reset", "journal", "rest", "gaming", "keyboard"] },
    { id: "personal", title: "Personal / admin", emoji: "🧾", terms: ["admin", "shopping", "life planning", "gift", "messages", "reply"] },
    { id: "cleaning", title: "Cleaning", emoji: "🧽", terms: ["cleaning", "vacuum", "surface", "mirror", "windows", "rubbish", "recycling", "crockery"] },
    { id: "projects", title: "Projects / room setup", emoji: "🧰", terms: ["room setup", "project", "shelves", "storage", "bug", "noise", "hanger", "labels"] },
    { id: "crafts", title: "Crafts / creative", emoji: "🎨", terms: ["creative", "craft", "crochet", "dress", "upscale", "cardboard", "canderel"] },
    { id: "clothes", title: "Clothes", emoji: "👕", terms: ["clothes", "sell", "stock", "vinted", "photos", "listed"] },
    { id: "one-off", title: "One-off / temporary", emoji: "📌", terms: ["one-off"] },
    { id: "other", title: "Other", emoji: "✨", terms: [] }
  ];

  function readState() {
    try { return JSON.parse(localStorage.getItem(GROUP_STATE_KEY)) || { active: "uni", collapsed: {} }; }
    catch { return { active: "uni", collapsed: {} }; }
  }

  function writeState(state) {
    localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state));
  }

  function cardText(card) {
    return [
      card.querySelector("h3")?.textContent,
      card.querySelector(".type-badge")?.textContent,
      card.querySelector(".task-meta")?.textContent,
      card.querySelector(".tiny-step")?.textContent,
      card.classList.contains("one-off") ? "one-off" : ""
    ].join(" ").toLowerCase();
  }

  function groupFor(card) {
    const text = cardText(card);
    if (text.includes("one-off")) return groups.find(g => g.id === "one-off");
    return groups.find(group => group.id !== "one-off" && group.id !== "other" && group.terms.some(term => text.includes(term))) || groups.find(group => group.id === "other");
  }

  function makeControls(list, buckets) {
    const state = readState();
    let controls = document.getElementById("pileGroupTabs");
    if (!controls) {
      controls = document.createElement("div");
      controls.id = "pileGroupTabs";
      controls.className = "pile-tabs";
      list.parentElement?.insertBefore(controls, list);
    }

    controls.innerHTML = "";
    groups.forEach(group => {
      const count = buckets.get(group.id)?.length || 0;
      if (!count) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pile-tab ${state.active === group.id ? "active" : ""}`;
      button.dataset.group = group.id;
      button.innerHTML = `<span>${group.emoji} ${group.title}</span><strong>${count}</strong>`;
      button.addEventListener("click", () => {
        const next = readState();
        next.active = group.id;
        writeState(next);
        showActivePile(group.id);
      });
      controls.appendChild(button);
    });

    if (!buckets.get(state.active)?.length) {
      const first = groups.find(group => buckets.get(group.id)?.length)?.id || "other";
      state.active = first;
      writeState(state);
    }
  }

  function showActivePile(groupId) {
    const state = readState();
    const active = groupId || state.active;
    document.querySelectorAll(".pile-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.group === active));
    document.querySelectorAll(".pile-section").forEach(section => section.hidden = section.dataset.group !== active);
  }

  function groupPiles() {
    if (isGrouping) return;
    const list = document.getElementById("unscheduledList");
    if (!list) return;
    const directCards = [...list.children].filter(child => child.classList?.contains("task-card"));
    if (!directCards.length) return;

    isGrouping = true;
    const buckets = new Map(groups.map(group => [group.id, []]));
    directCards.forEach(card => buckets.get(groupFor(card).id).push(card));
    makeControls(list, buckets);

    list.innerHTML = "";
    list.classList.add("pile-list");
    groups.forEach(group => {
      const cards = buckets.get(group.id) || [];
      if (!cards.length) return;
      const section = document.createElement("section");
      section.className = "pile-section";
      section.dataset.group = group.id;
      section.innerHTML = `<div class="pile-section-header"><span>${group.emoji} ${group.title}</span><span>${cards.length} task${cards.length === 1 ? "" : "s"}</span></div><div class="pile-section-grid"></div>`;
      const grid = section.querySelector(".pile-section-grid");
      cards.forEach(card => grid.appendChild(card));
      list.appendChild(section);
    });
    showActivePile(readState().active);
    isGrouping = false;
  }

  function scheduleGrouping() {
    window.setTimeout(groupPiles, 60);
  }

  document.addEventListener("DOMContentLoaded", scheduleGrouping);
  window.addEventListener("load", scheduleGrouping);
  document.addEventListener("submit", scheduleGrouping, true);
  document.addEventListener("click", event => {
    if (event.target.closest("button") || event.target.closest(".task-card") || event.target.closest(".slot")) scheduleGrouping();
  }, true);
  document.addEventListener("drop", scheduleGrouping, true);
})();
