const urlEl = document.getElementById("current-url");
const groupSelect = document.getElementById("group-select");
const blockDomainBtn = document.getElementById("block-domain");
const blockSectionBtn = document.getElementById("block-section");
const domainTargetEl = document.getElementById("domain-target");
const sectionInput = document.getElementById("section-input");
const statusEl = document.getElementById("status");
const settingsBtn = document.getElementById("open-settings");

let currentTab = null;
let settings = null;
let domainRule = null;
let suggestedSection = null;

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

function deriveRules(urlString) {
  try {
    const u = new URL(urlString);
    if (!/^https?:$/.test(u.protocol)) return { domain: null, section: null };
    const hostname = u.hostname.toLowerCase();
    const segments = (u.pathname || "/").split("/").filter(Boolean);
    let sectionPath;
    if (segments.length === 0) sectionPath = null;
    else if (segments.length === 1) sectionPath = "/" + segments[0];
    else sectionPath = "/" + segments.slice(0, 2).join("/");
    return {
      domain: hostname,
      section: sectionPath ? hostname + sectionPath : null
    };
  } catch {
    return { domain: null, section: null };
  }
}

function populateGroups(preferredId) {
  groupSelect.innerHTML = "";
  for (const g of settings.groups) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name || "Untitled";
    groupSelect.appendChild(opt);
  }
  if (preferredId && settings.groups.some((g) => g.id === preferredId)) {
    groupSelect.value = preferredId;
  }
}

function ruleExists(rule) {
  if (!rule) return false;
  const groupId = groupSelect.value;
  const group = settings.groups.find((g) => g.id === groupId);
  if (!group) return false;
  return group.sites.some((s) => s.trim().toLowerCase() === rule.trim().toLowerCase());
}

function refreshButtons() {
  if (domainRule) {
    domainTargetEl.textContent = domainRule;
    blockDomainBtn.disabled = ruleExists(domainRule);
  } else {
    domainTargetEl.textContent = "(unavailable)";
    blockDomainBtn.disabled = true;
  }

  const sectionVal = sectionInput.value.trim();
  const sameAsDomain = sectionVal && domainRule && sectionVal.toLowerCase() === domainRule;
  if (!sectionVal || sameAsDomain) {
    blockSectionBtn.disabled = true;
  } else {
    blockSectionBtn.disabled = ruleExists(sectionVal);
  }
}

async function addRule(rule) {
  const groupId = groupSelect.value;
  const group = settings.groups.find((g) => g.id === groupId);
  if (!group) return;
  const normalized = rule.trim().toLowerCase();
  if (!normalized) return;
  if (group.sites.some((s) => s.trim().toLowerCase() === normalized)) return;
  group.sites.push(normalized);
  await chrome.storage.sync.set({ settings });
  await chrome.storage.local.set({ lastUsedGroupId: groupId });
  statusEl.textContent = "Added to " + (group.name || "group");
  refreshButtons();
}

blockDomainBtn.addEventListener("click", () => domainRule && addRule(domainRule));
blockSectionBtn.addEventListener("click", () => {
  const val = sectionInput.value.trim();
  if (val) addRule(val);
});
groupSelect.addEventListener("change", refreshButtons);
sectionInput.addEventListener("input", refreshButtons);

(async function init() {
  const [tabs, settingsResult, localResult] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.runtime.sendMessage({ type: "getSettings" }),
    chrome.storage.local.get("lastUsedGroupId")
  ]);
  currentTab = tabs[0];
  settings = settingsResult;
  const lastUsedGroupId = localResult?.lastUsedGroupId;

  if (currentTab?.url) {
    urlEl.textContent = currentTab.url;
    const { domain, section } = deriveRules(currentTab.url);
    domainRule = domain;
    suggestedSection = section;
    sectionInput.value = section || (domain || "");
  } else {
    urlEl.textContent = "(no active tab)";
  }

  if (!settings) {
    statusEl.textContent = "Could not load settings.";
    return;
  }
  populateGroups(lastUsedGroupId);
  refreshButtons();
})();
