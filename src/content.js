if (!window.browser) {
  browser = chrome;
}

// https://stackoverflow.com/a/61511955
function waitForElement(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
}

class FeedFilter {
  constructor(name, filterFileName) {
    this.name = name;
    this.filterFile = `/src/filters/${filterFileName}.js`;
  }
}

class FilterMenu {
  constructor(filters, activeFilterIndex) {
    this.activeFilterIndex = activeFilterIndex;
    this.filters = filters;
    this.root = document.createElement("ul");
    this.root.className = "collectionNav g-tabs g-tabs-large";
    for (const [i, filter] of filters.entries()) {
      const li = document.createElement("li");
      li.className = "g-tabs-item";
      const button = document.createElement("a");
      button.className =
        activeFilterIndex === i ? "g-tabs-link active" : "g-tabs-link";
      button.textContent = filter.name;

      button.addEventListener("click", (e) => {
        browser.storage.sync.set({ activeSCFeedFilterIndex: i }).then(() => {
          window.location.reload();
        });
      });

      li.appendChild(button);
      this.root.appendChild(li);
    }
  }
}

const FILTERS = [
  new FeedFilter("Default", "default"),
  new FeedFilter("No reposts", "noReposts"),
  new FeedFilter("Not following", "notFollowing"),
  new FeedFilter("Only singles", "onlySingles"),
  new FeedFilter("Deep cuts", "deepCuts"),
  new FeedFilter("Custom", "custom"),
];

const CUSTOM_FILTER_INDEX = FILTERS.length - 1;

const DEFAULT_CUSTOM_PARAMS = {
  trackType: "tracks",
  playCountOp: ">=",
  playCount: null,
};

function buildCustomSettings(params) {
  const container = document.createElement("div");
  container.id = "sc-filter-custom-settings";

  // Tracks/Mixes toggle
  const toggleGroup = document.createElement("div");
  toggleGroup.className = "sc-filter-toggle-group";

  for (const type of ["tracks", "mixes"]) {
    const btn = document.createElement("button");
    btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    btn.className = "sc-filter-toggle-btn" + (params.trackType === type ? " active" : "");
    btn.addEventListener("click", () => {
      const newParams = Object.assign({}, params, { trackType: type });
      browser.storage.sync.set({ customSCFilterParams: newParams }).then(() => {
        window.location.reload();
      });
    });
    toggleGroup.appendChild(btn);
  }

  // Play count filter
  const playsGroup = document.createElement("div");
  playsGroup.className = "sc-filter-plays-group";

  const playsLabel = document.createElement("span");
  playsLabel.textContent = "Plays:";

  const opSelect = document.createElement("select");
  opSelect.className = "sc-filter-op-select";
  for (const [value, label] of [[">=", "\u2265"], ["<=", "\u2264"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (params.playCountOp === value) option.selected = true;
    opSelect.appendChild(option);
  }
  opSelect.addEventListener("change", () => {
    const newParams = Object.assign({}, params, { playCountOp: opSelect.value });
    browser.storage.sync.set({ customSCFilterParams: newParams }).then(() => {
      window.location.reload();
    });
  });

  const countInput = document.createElement("input");
  countInput.type = "number";
  countInput.min = "0";
  countInput.placeholder = "any";
  countInput.className = "sc-filter-count-input";
  if (params.playCount != null) countInput.value = params.playCount;

  const saveCount = () => {
    const val = countInput.value.trim();
    const newCount = val === "" ? null : parseInt(val, 10);
    const newParams = Object.assign({}, params, { playCount: isNaN(newCount) ? null : newCount });
    browser.storage.sync.set({ customSCFilterParams: newParams }).then(() => {
      window.location.reload();
    });
  };

  countInput.addEventListener("blur", saveCount);
  countInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveCount();
  });

  playsGroup.appendChild(playsLabel);
  playsGroup.appendChild(opSelect);
  playsGroup.appendChild(countInput);

  container.appendChild(toggleGroup);
  container.appendChild(playsGroup);

  return container;
}

function injectCustomStyles() {
  if (document.getElementById("sc-filter-styles")) return;
  const style = document.createElement("style");
  style.id = "sc-filter-styles";
  style.textContent = `
    #sc-filter-custom-settings {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 0;
    }
    .sc-filter-toggle-group {
      display: flex;
    }
    .sc-filter-toggle-btn {
      background: none;
      border: 1px solid #ccc;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 13px;
      color: inherit;
    }
    .sc-filter-toggle-btn:first-child {
      border-radius: 3px 0 0 3px;
    }
    .sc-filter-toggle-btn:last-child {
      border-radius: 0 3px 3px 0;
      border-left: none;
    }
    .sc-filter-toggle-btn.active {
      background: #f50;
      border-color: #f50;
      color: #fff;
    }
    .sc-filter-plays-group {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }
    .sc-filter-op-select {
      background: none;
      border: 1px solid #ccc;
      border-radius: 3px;
      padding: 3px 6px;
      font-size: 14px;
      color: inherit;
      cursor: pointer;
    }
    .sc-filter-count-input {
      background: none;
      border: 1px solid #ccc;
      border-radius: 3px;
      padding: 3px 6px;
      width: 80px;
      font-size: 13px;
      color: inherit;
    }
  `;
  document.documentElement.appendChild(style);
}

function initFilters() {
  if (!document.getElementById("sc-filter-script-1")) {
    let script = document.createElement("script");
    script.id = "sc-filter-script-1";
    script.src = browser.runtime.getURL("/src/filter.js");
    document.documentElement.appendChild(script);
  }
  if (window.location.href.includes("soundcloud.com/feed")) {
    waitForElement(".stream__header").then((header) => {
      Promise.all([
        browser.storage.sync.get("activeSCFeedFilterIndex"),
        browser.storage.sync.get("customSCFilterParams"),
      ]).then(([indexItem, paramsItem]) => {
        const activeFilterIndex = indexItem.activeSCFeedFilterIndex || 0;
        const customParams = Object.assign(
          {},
          DEFAULT_CUSTOM_PARAMS,
          paramsItem.customSCFilterParams || {}
        );

        const filterMenu = new FilterMenu(FILTERS, activeFilterIndex);
        header.replaceChildren(filterMenu.root);

        if (activeFilterIndex === CUSTOM_FILTER_INDEX) {
          injectCustomStyles();
          const settingsPanel = buildCustomSettings(customParams);
          header.appendChild(settingsPanel);
        }

        if (!document.getElementById("sc-filter-script-2")) {
          if (activeFilterIndex === CUSTOM_FILTER_INDEX) {
            const paramsScript = document.createElement("script");
            paramsScript.textContent = `window.scFilterParams = ${JSON.stringify(customParams)};`;
            document.documentElement.appendChild(paramsScript);
          }

          let script = document.createElement("script");
          script.id = "sc-filter-script-2";
          script.src = browser.runtime.getURL(
            FILTERS[activeFilterIndex].filterFile
          );
          document.documentElement.appendChild(script);
        }
      });
    });
  }
}

waitForElement("#content").then((content) => {
  const observer = new MutationObserver(initFilters);
  observer.observe(content, { childList: true });
});

initFilters();
