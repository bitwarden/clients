import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportOption, ImportType } from "../../models";

import { ImportSourceSelectComponent } from "./import-source-select.component";

jest.mock("../../models", () => {
  const actual = jest.requireActual("../../models");

  function buildOption(overrides: Partial<ImportOption> & { id: string }): ImportOption {
    return {
      name: overrides.id,
      featuredImporter: false,
      isBrowser: false,
      acceptedFileTypes: ["csv"],
      pasteFormats: ["csv"],
      hasDirectImporter: false,
      loaders: [],
      ...overrides,
    };
  }

  return {
    ...actual,
    // Featured vs. remaining is no longer a per-option flag — it's derived from real
    // membership in PICKER_FEATURED_PASSWORD_MANAGER_ORDER, so these ids are chosen to match
    // that real list rather than set via an override here.
    importOptions: [
      buildOption({ id: "chromecsv", name: "Chrome", isBrowser: true }),
      buildOption({ id: "firefoxcsv", name: "Firefox (csv)", isBrowser: true }),
      buildOption({ id: "1password1pux", name: "1Password (1pux/json)" }),
      buildOption({ id: "lastpasscsv", name: "LastPass" }),
      // Squished (no space) on purpose: displayNameFor's real value ("Zoho Vault", with a
      // space) diverges from this raw name — for the search-matches-display-name test below.
      buildOption({ id: "zohovaultcsv", name: "ZohoVault" }),
      buildOption({ id: "keepassxcsv", name: "KeePassX (csv)" }),
      buildOption({ id: "keepercsv", name: "Keeper (csv)" }),
      buildOption({ id: "keeperjson", name: "Keeper (json)" }),
      // Real id with a real picker vendor-metadata entry that has no icon — for the
      // generic-icon-tile-fallback test below.
      buildOption({ id: "gnomejson", name: "GNOME Passwords and Keys/Seahorse (json)" }),
      // Deliberately not a real ImportType — no entry in the real picker vendor metadata map at
      // all, for the exclusion test below. Using a fake id here (rather than a
      // real-but-currently-uncovered one) keeps that test from silently passing for the wrong
      // reason if that id ever gets a real metadata entry added later.
      buildOption({ id: "unknownvendorfixturecsv", name: "Unknown Vendor Fixture (csv)" }),
    ],
  };
});

describe("ImportSourceSelectComponent", () => {
  let fixture: ComponentFixture<ImportSourceSelectComponent>;
  let component: ImportSourceSelectComponent;

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key as string);
    i18nService.collator = new Intl.Collator("en");

    await TestBed.configureTestingModule({
      imports: [ImportSourceSelectComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportSourceSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function cardLabels(): string[] {
    return fixture.debugElement
      .queryAll(By.css("bit-form-control-card bit-label"))
      .map((el) => (el.nativeElement.textContent ?? "").trim());
  }

  function radioInputs(): HTMLInputElement[] {
    return fixture.debugElement
      .queryAll(By.css("input[type=radio]"))
      .map((el) => el.nativeElement as HTMLInputElement);
  }

  it("only checks one radio at a time when the user clicks through real cards, not FormControl.setValue", () => {
    // Regression test: the component's `<ng-template #optionCard>` was previously declared
    // *outside* `bit-form-control-group` and rendered into it via `*ngTemplateOutlet` — Angular
    // resolves such a template's DI from its declaration site, not the outlet's render site, so
    // every radio's injected `FormControlGroupComponent` was silently null. That broke real clicks
    // (every card could be independently checked) while every other test here, which drives
    // selection via `sourceControl.setValue()`, kept passing — `setValue()` goes through
    // `writeValue()`, a completely different code path that was never affected by the bug.
    const [first, second] = radioInputs();

    first.click();
    fixture.detectChanges();
    expect(first.checked).toBe(true);

    second.click();
    fixture.detectChanges();
    expect(second.checked).toBe(true);
    expect(first.checked).toBe(false);
    expect(radioInputs().filter((r) => r.checked)).toHaveLength(1);
  });

  it("enables and emits Continue after a real click, not just FormControl.setValue", () => {
    const continueButton = fixture.debugElement.query(By.css("button[bitButton]"))
      .nativeElement as HTMLButtonElement;
    const emitted: ImportType[] = [];
    component.continue.subscribe((id) => emitted.push(id));

    const chrome = radioInputs()[0];
    chrome.click();
    fixture.detectChanges();

    expect(continueButton.getAttribute("aria-disabled")).toBeNull();
    continueButton.click();
    expect(emitted).toEqual(["chromecsv"]);
  });

  it("renders the breadcrumb label above the card", () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("importSourceBreadcrumb");
  });

  it("renders every browser, regardless of featured-password-manager status", () => {
    expect(cardLabels()).toEqual(expect.arrayContaining(["Chrome", "Firefox"]));
  });

  it("renders only the featured password managers by default", () => {
    const labels = cardLabels();
    expect(labels).toEqual(expect.arrayContaining(["1Password", "LastPass"]));
    expect(labels).not.toContain("Zoho Vault");
    expect(labels).not.toContain("KeePassX");
  });

  it("shows a clean vendor display name, not ImportOption.name's format suffix", () => {
    // "Firefox (csv)" and "1Password (1pux/json)" are the real ImportOption.name values (see the
    // mocked fixture above) — the picker must show the vendor-only name from
    // import-source-picker-metadata.ts instead.
    const labels = cardLabels();
    expect(labels).not.toContain("Firefox (csv)");
    expect(labels).not.toContain("1Password (1pux/json)");
  });

  it("excludes ids with no picker vendor metadata entry from the grid entirely", () => {
    component["searchControl"].setValue("unknown vendor");
    fixture.detectChanges();

    expect(cardLabels()).toEqual([]);
  });

  it("excludes the hidden legacy Keeper duplicate ids", () => {
    const labels = cardLabels();
    expect(labels).not.toContain("Keeper (csv)");
    expect(labels).not.toContain("Keeper (json)");
  });

  it("reveals the remaining password managers when Show all is clicked", () => {
    const showAllButton = fixture.debugElement.query(By.css("button[bitLink]"));
    expect(showAllButton).toBeTruthy();

    showAllButton.nativeElement.click();
    fixture.detectChanges();

    expect(cardLabels()).toEqual(expect.arrayContaining(["Zoho Vault", "KeePassX"]));
  });

  it("reveals matching remaining password managers while searching", () => {
    component["searchControl"].setValue("zoho");
    fixture.detectChanges();

    expect(cardLabels()).toEqual(["Zoho Vault"]);

    // The disclosure wrapping this result must actually be visible, not just present in the
    // DOM — DisclosureComponent hides its host with `tw-hidden` whenever `open` is false.
    const disclosure = fixture.debugElement.query(By.css("bit-disclosure"));
    expect((disclosure.nativeElement as HTMLElement).classList).not.toContain("tw-hidden");
  });

  it("matches search against the display name even when it differs from ImportOption.name", () => {
    // Mocked fixture: id "zohovaultcsv", ImportOption.name "ZohoVault" (no space), display name
    // "Zoho Vault" (with a space, from the real picker metadata) — searching the display name's
    // exact text must still work even though it isn't a substring of the raw name.
    component["searchControl"].setValue("zoho vault");
    fixture.detectChanges();

    expect(cardLabels()).toEqual(["Zoho Vault"]);
  });

  it("keeps a single source of truth for the disclosure's open state across search and manual toggle", () => {
    component["searchControl"].setValue("zoho");
    fixture.detectChanges();
    expect(cardLabels()).toContain("Zoho Vault");

    // Manually collapsing while a search is active must actually take effect, not be silently
    // overridden by the search-driven default on the next change detection pass.
    const showAllButton = fixture.debugElement.query(By.css("button[bitLink]"));
    showAllButton.nativeElement.click();
    fixture.detectChanges();

    expect(cardLabels()).not.toContain("Zoho Vault");
    const disclosure = fixture.debugElement.query(By.css("bit-disclosure"));
    expect((disclosure.nativeElement as HTMLElement).classList).toContain("tw-hidden");
  });

  it("keeps a selection made from Show all visible after the search that revealed it is cleared", () => {
    component["searchControl"].setValue("zoho");
    fixture.detectChanges();

    component["sourceControl"].setValue("zohovaultcsv" as ImportType);
    fixture.detectChanges();

    component["searchControl"].setValue("");
    fixture.detectChanges();

    expect(cardLabels()).toContain("Zoho Vault");
    const continueButton = fixture.debugElement.query(By.css("button[bitButton]"))
      .nativeElement as HTMLButtonElement;
    expect(continueButton.getAttribute("aria-disabled")).toBeNull();
  });

  it("does not reopen Show all just because an unrelated option was selected", () => {
    const showAllButton = fixture.debugElement.query(By.css("button[bitLink]"));
    showAllButton.nativeElement.click();
    fixture.detectChanges();
    expect(cardLabels()).toContain("Zoho Vault");

    showAllButton.nativeElement.click();
    fixture.detectChanges();
    expect(cardLabels()).not.toContain("Zoho Vault");

    component["sourceControl"].setValue("chromecsv" as ImportType);
    fixture.detectChanges();

    expect(cardLabels()).not.toContain("Zoho Vault");
  });

  it("shows a no-results message when the search matches nothing", () => {
    component["searchControl"].setValue("nonexistent-vendor-xyz");
    fixture.detectChanges();

    expect(cardLabels()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("noMatchingItems");
  });

  it("keeps Continue disabled until a source is selected, then emits it", () => {
    const continueButton = fixture.debugElement.query(By.css("button[bitButton]"))
      .nativeElement as HTMLButtonElement;
    expect(continueButton.getAttribute("aria-disabled")).toBe("true");

    const emitted: ImportType[] = [];
    component.continue.subscribe((id) => emitted.push(id));

    component["sourceControl"].setValue("chromecsv" as ImportType);
    fixture.detectChanges();
    expect(continueButton.getAttribute("aria-disabled")).toBeNull();

    continueButton.click();
    expect(emitted).toEqual(["chromecsv"]);
  });

  it("re-disables Continue when the selected card is filtered out by search", () => {
    const continueButton = fixture.debugElement.query(By.css("button[bitButton]"))
      .nativeElement as HTMLButtonElement;

    component["sourceControl"].setValue("chromecsv" as ImportType);
    fixture.detectChanges();
    expect(continueButton.getAttribute("aria-disabled")).toBeNull();

    component["searchControl"].setValue("zoho");
    fixture.detectChanges();

    expect(cardLabels()).not.toContain("Chrome");
    expect(continueButton.getAttribute("aria-disabled")).toBe("true");

    const emitted: ImportType[] = [];
    component.continue.subscribe((id) => emitted.push(id));
    continueButton.click();
    expect(emitted).toEqual([]);
  });

  it("falls back to a generic icon tile when an option has no vendor art", () => {
    component["searchControl"].setValue("gnome");
    fixture.detectChanges();

    const card = fixture.debugElement.query(By.css("bit-form-control-card"));
    expect(card.query(By.css("bit-icon-tile"))).toBeTruthy();
    expect(card.query(By.css("bit-svg"))).toBeFalsy();
  });

  it("renders a real vendor icon when one is available", () => {
    const card = fixture.debugElement.query(By.css("bit-form-control-card"));
    expect(card.query(By.css("bit-svg"))).toBeTruthy();
    expect(card.query(By.css("bit-icon-tile"))).toBeFalsy();
  });
});
