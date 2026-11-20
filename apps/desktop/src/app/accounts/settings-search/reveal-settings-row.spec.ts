import {
  SETTINGS_ROW_HIGHLIGHT_FADE_MS,
  SETTINGS_ROW_HIGHLIGHT_MS,
  clearSettingsRowHighlight,
  revealSettingsRow,
} from "./reveal-settings-row";

describe("revealSettingsRow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    clearSettingsRowHighlight();
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  function renderRows() {
    document.body.innerHTML = `
      <div id="settings-row-theme">
        <span>Theme</span>
        <button type="button" disabled id="disabled">x</button>
        <input type="checkbox" id="switch" />
        <button type="button" id="later">y</button>
      </div>
      <div id="settings-row-sync"><span>Sync</span></div>`;
    return {
      theme: document.getElementById("settings-row-theme")!,
      sync: document.getElementById("settings-row-sync")!,
    };
  }

  it("returns false when the row does not exist", () => {
    expect(revealSettingsRow("missing-row")).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("scrolls the row into view and focuses its first enabled control", () => {
    const { theme } = renderRows();
    theme.scrollIntoView = jest.fn();

    expect(revealSettingsRow("settings-row-theme")).toBe(true);

    expect(theme.scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(document.activeElement?.id).toBe("switch");
    expect(theme.hasAttribute("tabindex")).toBe(false);
  });

  it("suppresses the focus ring by default and keeps it for keyboard reveals", () => {
    renderRows();
    const control = document.getElementById("switch")!;
    const focus = jest.spyOn(control, "focus");

    revealSettingsRow("settings-row-theme");
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true, focusVisible: false });

    revealSettingsRow("settings-row-theme", { focusVisible: true });
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true, focusVisible: true });
  });

  it("focuses a row without a control without showing an outline", () => {
    const { sync } = renderRows();
    const focus = jest.spyOn(sync, "focus");

    expect(revealSettingsRow("settings-row-sync", { focusVisible: true })).toBe(true);

    expect(sync.getAttribute("tabindex")).toBe("-1");
    expect(sync.classList).toContain("tw-outline-none");
    expect(document.activeElement).toBe(sync);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false });
  });

  it("highlights the row, fades it out and then removes every class it added", () => {
    const { theme } = renderRows();

    revealSettingsRow("settings-row-theme");
    expect(theme.classList).toContain("tw-bg-bg-brand-softer");
    expect(theme.classList).toContain("tw-transition-colors");
    expect(theme.classList).toContain("motion-reduce:tw-transition-none");

    jest.advanceTimersByTime(SETTINGS_ROW_HIGHLIGHT_MS - 1);
    expect(theme.classList).toContain("tw-bg-bg-brand-softer");

    jest.advanceTimersByTime(1);
    // Background removed, transition kept so the fade can run.
    expect(theme.classList).not.toContain("tw-bg-bg-brand-softer");
    expect(theme.classList).toContain("tw-transition-colors");

    jest.advanceTimersByTime(SETTINGS_ROW_HIGHLIGHT_FADE_MS);
    expect(theme.className).toBe("");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("moves the highlight when another row is revealed before the first one clears", () => {
    const { theme, sync } = renderRows();

    revealSettingsRow("settings-row-theme");
    jest.advanceTimersByTime(SETTINGS_ROW_HIGHLIGHT_MS / 2);
    revealSettingsRow("settings-row-sync");

    expect(theme.className).toBe("");
    expect(sync.classList).toContain("tw-bg-bg-brand-softer");
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(SETTINGS_ROW_HIGHLIGHT_MS + SETTINGS_ROW_HIGHLIGHT_FADE_MS);
    expect(sync.classList).not.toContain("tw-bg-bg-brand-softer");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("restarts the highlight when the same row is revealed again", () => {
    const { theme } = renderRows();

    revealSettingsRow("settings-row-theme");
    jest.advanceTimersByTime(SETTINGS_ROW_HIGHLIGHT_MS - 100);
    revealSettingsRow("settings-row-theme");
    jest.advanceTimersByTime(200);

    expect(theme.classList).toContain("tw-bg-bg-brand-softer");
    expect(jest.getTimerCount()).toBe(1);
  });

  it("clearSettingsRowHighlight cancels pending timers and removes the highlight", () => {
    const { theme } = renderRows();

    revealSettingsRow("settings-row-theme");
    clearSettingsRowHighlight();

    expect(theme.className).toBe("");
    expect(jest.getTimerCount()).toBe(0);
  });
});
