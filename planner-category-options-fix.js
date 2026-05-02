(() => {
  if (window.__plannerCategoryOptionsFixLoaded) return;
  window.__plannerCategoryOptionsFixLoaded = true;

  function selectedLabel(select) {
    return select?.selectedOptions?.[0]?.textContent?.trim() || "";
  }

  function syncCategoryInput(modal) {
    const select = modal?.querySelector?.("#taskOptionsCategoryGroup");
    const input = modal?.querySelector?.("#taskOptionsCategory");
    if (!select || !input) return;
    const label = selectedLabel(select);
    if (!label) return;
    input.value = label;
    input.dataset.syncedFromGroup = select.value;
  }

  document.addEventListener("change", event => {
    if (!event.target.matches?.("#taskOptionsCategoryGroup")) return;
    syncCategoryInput(event.target.closest("#taskOptionsModal"));
  }, true);

  document.addEventListener("submit", event => {
    if (!event.target.matches?.("#taskOptionsForm")) return;
    syncCategoryInput(event.target.closest("#taskOptionsModal"));
  }, true);
})();
