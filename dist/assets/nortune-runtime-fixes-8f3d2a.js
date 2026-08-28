const MODE_GROUP_SELECTOR = '.mode-selector__options[role="radiogroup"]';
const MODE_RADIO_SELECTOR = '[role="radio"]';
const ANNOUNCER_ID = 'nortune-runtime-announcer';

function getRadios(group) {
  return Array.from(group.querySelectorAll(MODE_RADIO_SELECTOR)).filter(
    (element) => element instanceof HTMLButtonElement
  );
}

function syncRadioTabStops(group) {
  const radios = getRadios(group);
  const selected = radios.find((radio) => radio.getAttribute('aria-checked') === 'true') ?? radios[0];
  for (const radio of radios) radio.tabIndex = radio === selected ? 0 : -1;
}

function initializeModeGroup(group) {
  if (!(group instanceof HTMLElement) || group.dataset.nortuneRadioReady === 'true') return;
  group.dataset.nortuneRadioReady = 'true';
  group.setAttribute('aria-orientation', 'horizontal');
  syncRadioTabStops(group);

  group.addEventListener('keydown', (event) => {
    const radios = getRadios(group);
    if (!radios.length) return;
    const focused = document.activeElement instanceof HTMLButtonElement
      ? document.activeElement
      : radios.find((radio) => radio.getAttribute('aria-checked') === 'true') ?? radios[0];
    const currentIndex = Math.max(0, radios.indexOf(focused));
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % radios.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + radios.length) % radios.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = radios.length - 1;
    else return;

    event.preventDefault();
    const next = radios[nextIndex];
    next.click();
    queueMicrotask(() => {
      syncRadioTabStops(group);
      next.focus();
      announce(`${next.innerText.trim()} selected.`);
    });
  });

  group.addEventListener('click', () => queueMicrotask(() => syncRadioTabStops(group)));
  new MutationObserver(() => syncRadioTabStops(group)).observe(group, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });
}

function announcer() {
  let region = document.getElementById(ANNOUNCER_ID);
  if (region) return region;
  region = document.createElement('div');
  region.id = ANNOUNCER_ID;
  region.className = 'sr-only';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
  return region;
}

function announce(message) {
  const region = announcer();
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 20);
}

function enhanceLiveRegions(root = document) {
  root.querySelectorAll('.warning-block').forEach((warning) => {
    warning.setAttribute('role', 'alert');
    warning.setAttribute('aria-live', 'assertive');
  });
  root.querySelectorAll('.stale-banner, .stale-note').forEach((notice) => {
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
  });
}

function initializeDownloadAnnouncements() {
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const label = button.innerText.trim();
    if (/^Download\b/i.test(label)) announce(`${label} started.`);
  });
}

function initialize() {
  document.querySelectorAll(MODE_GROUP_SELECTOR).forEach(initializeModeGroup);
  enhanceLiveRegions();
  initializeDownloadAnnouncements();
  announcer();

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(MODE_GROUP_SELECTOR)) initializeModeGroup(node);
        node.querySelectorAll?.(MODE_GROUP_SELECTOR).forEach(initializeModeGroup);
        enhanceLiveRegions(node);
      }
    }
  }).observe(document.body, { subtree: true, childList: true });
}

initialize();
