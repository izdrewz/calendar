(() => {
  if (window.__plannerCategoryExpandLoaded) return;
  window.__plannerCategoryExpandLoaded = true;

  const KEY = "planner-category-tray-expanded-v2";

  function expanded() {
    return localStorage.getItem(KEY) === "true";
  }

  function setExpanded(value) {
    localStorage.setItem(KEY, value ? "true" : "false");
    applyState();
  }

  function makeButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-expand-toggle ghost";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(!expanded());
    });
    return button;
  }

  function ensureButton() {
    const panel = document.querySelector(".mock-category-panel");
    if (!panel) return null;

    let button = panel.querySelector(".category-expand-toggle");
    if (!button) button = makeButton();

    const header = panel.querySelector(".pile-section-header");
    if (header) {
      const add = header.querySelector(".add-new-category");
      if (button.parentElement !== header) button.remove();
      if (!header.querySelector(".category-expand-toggle")) header.insertBefore(button, add || null);
      return button;
    }

    const tabs = panel.querySelector("#pileGroupTabs");
    if (button.parentElement !== panel) button.remove();
    if (!panel.querySelector(":scope > .category-expand-toggle")) {
      if (tabs?.nextSibling) panel.insertBefore(button, tabs.nextSibling);
      else panel.appendChild(button);
    }
    return button;
  }

  function applyState() {
    const panel = document.querySelector(".mock-category-panel");
    const button = ensureButton();
    if (!panel || !button) return;
    const isExpanded = expanded();
    panel.classList.toggle("category-tray-expanded", isExpanded);
    button.textContent = isExpanded ? "Collapse" : "Expand";
    button.setAttribute("aria-expanded", String(isExpanded));
    button.title = isExpanded ? "Collapse the task tray" : "Expand this task tray so the card options are easier to use";
  }

  function refresh() {
    ensureButton();
    applyState();
  }

  document.addEventListener("DOMContentLoaded", refresh);
  window.addEventListener("load", refresh);
  document.addEventListener("click", () => setTimeout(refresh, 80), true);
  document.addEventListener("drop", () => setTimeout(refresh, 120), true);
  document.addEventListener("submit", () => setTimeout(refresh, 120), true);
})();
