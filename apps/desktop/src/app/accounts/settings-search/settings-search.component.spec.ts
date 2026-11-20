import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SettingsSearchComponent, SettingsSearchSelection } from "./settings-search.component";
import { SettingsSearchEntry, SettingsSearchEntryId } from "./settings-search.registry";

const TRANSLATIONS: Record<string, string> = {
  security: "Security",
  general: "General",
  advancedHeader: "Advanced",
  settingsNavAccount: "Account settings",
  settingsNavDevice: "Device settings",
  themeLabel: "Theme",
  themeDesc: "Change the color theme.",
  languageLabel: "Language",
  pinLabel: "Unlock with PIN",
  screenshotsLabel: "Allow screenshots",
};

const ENTRIES: SettingsSearchEntry[] = [
  {
    id: "theme",
    page: "general",
    labelKey: "themeLabel",
    descriptionKey: "themeDesc",
    rowId: "r1",
  },
  { id: "language", page: "general", labelKey: "languageLabel", rowId: "r2" },
  { id: "unlockWithPin", page: "security", labelKey: "pinLabel", rowId: "r3" },
  { id: "allowScreenshots", page: "advanced", labelKey: "screenshotsLabel", rowId: "r4" },
];

describe("SettingsSearchComponent", () => {
  let fixture: ComponentFixture<SettingsSearchComponent>;
  let selected: SettingsSearchSelection[];
  const i18nService = mock<I18nService>();

  const input = () =>
    fixture.nativeElement.querySelector(
      "[data-testid='settings-search-input']",
    ) as HTMLInputElement;
  const listbox = () => fixture.nativeElement.querySelector("[role='listbox']") as HTMLElement;
  const options = () =>
    Array.from(fixture.nativeElement.querySelectorAll("[role='option']")) as HTMLElement[];
  const status = () =>
    (fixture.nativeElement.querySelector("[role='status']") as HTMLElement).textContent?.trim();
  const empty = () => fixture.nativeElement.querySelector("[data-testid='settings-search-empty']");
  const panel = () =>
    fixture.nativeElement.querySelector("[data-testid='settings-search-panel']") as HTMLElement;

  function type(value: string) {
    input().focus();
    input().dispatchEvent(new FocusEvent("focus"));
    input().value = value;
    input().dispatchEvent(new Event("input"));
    fixture.detectChanges();
  }

  function press(key: string) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  beforeEach(async () => {
    i18nService.t.mockImplementation((key: string, p1?: string | number) =>
      p1 === undefined ? (TRANSLATIONS[key] ?? key) : `${key}:${p1}`,
    );

    await TestBed.configureTestingModule({
      imports: [SettingsSearchComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsSearchComponent);
    fixture.componentRef.setInput("entries", ENTRIES);
    selected = [];
    fixture.componentInstance.selected.subscribe((e) => selected.push(e));
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders a combobox with an accessible label wired to a listbox", () => {
    const el = input();
    expect(el.getAttribute("role")).toBe("combobox");
    expect(el.getAttribute("aria-autocomplete")).toBe("list");
    expect(el.getAttribute("aria-controls")).toBe(listbox().id);
    expect(el.getAttribute("aria-expanded")).toBe("false");
    expect(el.id).toBe("settings-search_input_query");

    const label = fixture.nativeElement.querySelector(`label[for='${el.id}']`) as HTMLElement;
    expect(label.textContent).toContain("searchSettingsVfo1");
    expect(listbox().getAttribute("aria-label")).toBe("settingsSearchResultsVfo1");
  });

  it("shows nothing until the user types", () => {
    expect(panel().hidden).toBe(true);
    expect(options()).toHaveLength(0);
    expect(status()).toBe("");
  });

  it("lists matching settings with a scope and page breadcrumb", () => {
    type("the");

    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(panel().hidden).toBe(false);
    expect(options()).toHaveLength(1);
    expect(options()[0].textContent).toContain("Theme");
    const breadcrumb = options()[0].querySelector("[data-testid='settings-search-breadcrumb']");
    expect(breadcrumb?.textContent?.replace(/\s+/g, " ").trim()).toBe("Device settings General");
    expect(status()).toBe("settingsSearchOneResultVfo1");
  });

  it("announces the result count", () => {
    type("settings");
    expect(options()).toHaveLength(4);
    expect(status()).toBe("settingsSearchResultCountVfo1:4");
  });

  it("shows an empty state when nothing matches", () => {
    type("zzz");

    expect(options()).toHaveLength(0);
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(listbox().hidden).toBe(true);
    expect(empty()?.textContent).toContain("settingsSearchNoResultsVfo1");
    expect(status()).toBe("settingsSearchNoResultsVfo1");
  });

  it("hides entries the host reports as not visible", () => {
    const isVisible = (id: SettingsSearchEntryId) => id !== "language";
    fixture.componentRef.setInput("isVisible", isVisible);
    type("device settings");

    const labels = options().map((o) => o.querySelector("span")?.textContent?.trim());
    expect(labels).toEqual(["Theme", "Allow screenshots"]);
  });

  it("moves the active option with ArrowDown/ArrowUp, wrapping, via aria-activedescendant", () => {
    type("device settings"); // theme, language, allowScreenshots
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);

    expect(press("ArrowDown").defaultPrevented).toBe(true);
    expect(input().getAttribute("aria-activedescendant")).toBe(options()[0].id);
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    expect(options()[1].getAttribute("aria-selected")).toBe("false");

    press("ArrowDown");
    press("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).toBe(options()[2].id);
    press("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).toBe(options()[0].id);

    press("ArrowUp");
    expect(input().getAttribute("aria-activedescendant")).toBe(options()[2].id);
  });

  it("resets the active option when the query changes", () => {
    type("device settings");
    press("ArrowDown");
    type("theme");
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("selects the active option on Enter and clears the search", () => {
    type("device settings");
    press("ArrowDown");
    press("ArrowDown");

    const event = press("Enter");

    expect(event.defaultPrevented).toBe(true);
    expect(selected.map((s) => s.entry.id)).toEqual(["language"]);
    expect(selected[0].viaKeyboard).toBe(true);
    expect(input().value).toBe("");
    expect(panel().hidden).toBe(true);
  });

  it("selects the first result on Enter when no option is active", () => {
    type("allow");
    press("Enter");
    expect(selected.map((s) => s.entry.id)).toEqual(["allowScreenshots"]);
  });

  it("prevents form submission on Enter without selecting when there are no results", () => {
    type("zzz");
    expect(press("Enter").defaultPrevented).toBe(true);
    expect(selected).toEqual([]);
  });

  it("selects an option on click", () => {
    type("pin");
    options()[0].click();
    fixture.detectChanges();
    expect(selected.map((s) => s.entry.id)).toEqual(["unlockWithPin"]);
    expect(selected[0].viaKeyboard).toBe(false);
  });

  it("clears the query on Escape and stops propagation", () => {
    const outer = jest.fn();
    fixture.nativeElement.addEventListener("keydown", outer);
    type("theme");

    const event = press("Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
    expect(input().value).toBe("");
    expect(options()).toHaveLength(0);
  });

  it("lets Escape propagate when the field is already empty", () => {
    const outer = jest.fn();
    fixture.nativeElement.addEventListener("keydown", outer);
    const event = press("Escape");
    expect(event.defaultPrevented).toBe(false);
    expect(outer).toHaveBeenCalled();
  });

  it("uses the plain search field look, with the clear button only while there is text", () => {
    // No form-field prefix block: the icon sits inline, directly before the input.
    expect(fixture.nativeElement.querySelector("[bitprefix]")).toBeNull();
    expect(input().previousElementSibling?.tagName).toBe("BIT-ICON");
    expect(fixture.nativeElement.querySelector("[data-testid='settings-search-clear']")).toBeNull();

    type("theme");
    expect(
      fixture.nativeElement.querySelector("[data-testid='settings-search-clear']"),
    ).not.toBeNull();
  });

  it("clears the query from the clear button and keeps focus in the field", () => {
    type("theme");
    const clear = fixture.nativeElement.querySelector(
      "[data-testid='settings-search-clear']",
    ) as HTMLButtonElement;
    expect(clear.getAttribute("aria-label")).toBe("resetSearch");

    clear.click();
    fixture.detectChanges();

    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());
    expect(fixture.nativeElement.querySelector("[data-testid='settings-search-clear']")).toBeNull();
  });

  it("closes the panel when focus leaves the component", () => {
    type("theme");
    fixture.nativeElement.dispatchEvent(
      new FocusEvent("focusout", { relatedTarget: document.body }),
    );
    fixture.detectChanges();

    expect(panel().hidden).toBe(true);
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });
});
