const enabledEl = document.getElementById("enabled");
const backendUrlEl = document.getElementById("backendUrl");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");

chrome.storage.sync.get(["backendUrl", "enabled"], (data) => {
  enabledEl.checked = data.enabled !== false;
  backendUrlEl.value = data.backendUrl || "http://localhost:3000";
});

saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      enabled: enabledEl.checked,
      backendUrl: backendUrlEl.value.trim() || "http://localhost:3000",
    },
    () => {
      statusEl.textContent = "Saved ✓";
      setTimeout(() => (statusEl.textContent = ""), 1500);
    }
  );
});
