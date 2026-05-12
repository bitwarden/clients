import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { BehaviorSubject } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import {
  AutofillConfirmationDialogComponent,
  AutofillConfirmationDialogResult,
  AutofillConfirmationDialogParams,
} from "./autofill-confirmation-dialog.component";

function makeUri(uri: string, match?: UriMatchStrategySetting): LoginUriView {
  const v = new LoginUriView();
  v.uri = uri;
  v.match = match;
  return v;
}

describe("AutofillConfirmationDialogComponent", () => {
  let fixture: ComponentFixture<AutofillConfirmationDialogComponent>;
  let component: AutofillConfirmationDialogComponent;
  let uriMatchStrategy$: BehaviorSubject<UriMatchStrategySetting>;

  const dialogRef = {
    close: jest.fn(),
  } as unknown as DialogRef;

  const savedUris = [
    makeUri("https://one.example.com/a"),
    makeUri("https://two.example.com/b"),
    makeUri("https://three.example.com/c"),
  ];

  const params: AutofillConfirmationDialogParams = {
    currentUrl: "https://example.com/path?q=1",
    savedUris,
  };

  async function createFreshFixture(options?: {
    params?: AutofillConfirmationDialogParams;
    viewOnly?: boolean;
    uriMatchStrategy?: UriMatchStrategySetting;
  }) {
    const base = options?.params ?? params;
    const p: AutofillConfirmationDialogParams = {
      ...base,
      viewOnly: options?.viewOnly,
    };
    uriMatchStrategy$ = new BehaviorSubject<UriMatchStrategySetting>(
      options?.uriMatchStrategy ?? UriMatchStrategy.Domain,
    );

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AutofillConfirmationDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DIALOG_DATA, useValue: p },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: {} },
        {
          provide: DomainSettingsService,
          useValue: { resolvedDefaultUriMatchStrategy$: uriMatchStrategy$ },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    const freshFixture = TestBed.createComponent(AutofillConfirmationDialogComponent);
    const freshInstance = freshFixture.componentInstance;
    freshFixture.detectChanges();
    return { fixture: freshFixture, component: freshInstance };
  }

  beforeEach(async () => {
    uriMatchStrategy$ = new BehaviorSubject<UriMatchStrategySetting>(UriMatchStrategy.Domain);

    await TestBed.configureTestingModule({
      imports: [AutofillConfirmationDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: {} },
        {
          provide: DomainSettingsService,
          useValue: { resolvedDefaultUriMatchStrategy$: uriMatchStrategy$ },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AutofillConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const findShowAll = (fix?: ComponentFixture<AutofillConfirmationDialogComponent>) => {
    const result = (fix ?? fixture).debugElement.query(
      By.css('[data-test-id="toggle-show-saved-urls-button"]'),
    );
    return result?.nativeElement ?? null;
  };

  it("renders formatted hostname values into the template", () => {
    // Default Domain strategy → shows hostnames, not full URLs
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("one.example.com");
    expect(text).toContain("two.example.com");
    expect(text).toContain("three.example.com");
    expect(text).toContain("example.com");
  });

  it("emits Canceled on close()", () => {
    const spy = jest.spyOn(dialogRef, "close");
    (component as any)["close"]();
    expect(spy).toHaveBeenCalledWith(AutofillConfirmationDialogResult.Canceled);
  });

  it("emits AutofillAndUrlAdded on autofillAndAddUrl()", () => {
    const spy = jest.spyOn(dialogRef, "close");
    (component as any)["autofillAndAddUrl"]();
    expect(spy).toHaveBeenCalledWith(AutofillConfirmationDialogResult.AutofillAndUrlAdded);
  });

  it("emits AutofilledOnly on autofillOnly()", () => {
    const spy = jest.spyOn(dialogRef, "close");
    (component as any)["autofillOnly"]();
    expect(spy).toHaveBeenCalledWith(AutofillConfirmationDialogResult.AutofilledOnly);
  });

  it("applies collapsed list gradient class by default, then clears it after toggling", () => {
    const initial = component.savedUrlsListClass();
    expect(initial).toContain("gradient");

    component.toggleSavedUrlExpandedState();
    fixture.detectChanges();

    const expanded = component.savedUrlsListClass();
    expect(expanded).toBe("");
  });

  it("handles empty savedUris gracefully", async () => {
    const newParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://bitwarden.com/help",
      savedUris: [],
    };

    const { component: fresh } = await createFreshFixture({ params: newParams });
    expect(fresh.savedUrls()).toEqual([]);
    expect(fresh.formattedCurrentUrl()).toBe("bitwarden.com");
  });

  it("handles undefined savedUris by defaulting to []", async () => {
    const localParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://subdomain.example.com/x",
      savedUris: undefined,
    };

    const { component: local } = await createFreshFixture({ params: localParams });
    expect(local.savedUrls()).toEqual([]);
    expect(local.formattedCurrentUrl()).toBe("subdomain.example.com");
  });

  it("formattedCurrentUrl returns hostname when default strategy is Domain", () => {
    expect(component.showFullUrls()).toBe(false);
    expect(component.formattedCurrentUrl()).toBe("example.com");
  });

  it("formattedCurrentUrl returns full URL when default strategy is StartsWith", async () => {
    const { component: c } = await createFreshFixture({
      uriMatchStrategy: UriMatchStrategy.StartsWith,
    });
    expect(c.showFullUrls()).toBe(true);
    expect(c.formattedCurrentUrl()).toBe("https://example.com/path?q=1");
  });

  it("formattedCurrentUrl returns full URL when default strategy is RegularExpression", async () => {
    const { component: c } = await createFreshFixture({
      uriMatchStrategy: UriMatchStrategy.RegularExpression,
    });
    expect(c.showFullUrls()).toBe(true);
    expect(c.formattedCurrentUrl()).toBe("https://example.com/path?q=1");
  });

  it("formattedSavedUrls returns hostnames when default strategy is Domain", () => {
    expect(component.formattedSavedUrls()).toEqual([
      "one.example.com",
      "two.example.com",
      "three.example.com",
    ]);
  });

  it("formattedSavedUrls returns full URIs when default strategy is StartsWith", async () => {
    const { component: c } = await createFreshFixture({
      uriMatchStrategy: UriMatchStrategy.StartsWith,
    });
    expect(c.formattedSavedUrls()).toEqual([
      "https://one.example.com/a",
      "https://two.example.com/b",
      "https://three.example.com/c",
    ]);
  });

  it("showFullUrls is true when any saved URI has StartsWith match strategy", async () => {
    const mixedParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://example.com",
      savedUris: [
        makeUri("https://one.example.com/a"),
        makeUri("https://two.example.com/b", UriMatchStrategy.StartsWith),
      ],
    };
    const { component: c } = await createFreshFixture({ params: mixedParams });
    expect(c.showFullUrls()).toBe(true);
  });

  it("showFullUrls is true when any saved URI has RegularExpression match strategy", async () => {
    const mixedParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://example.com",
      savedUris: [
        makeUri("https://one.example.com/a"),
        makeUri(".*example\\.com.*", UriMatchStrategy.RegularExpression),
      ],
    };
    const { component: c } = await createFreshFixture({ params: mixedParams });
    expect(c.showFullUrls()).toBe(true);
  });

  it("renders one current-url callout and N saved-url callouts", () => {
    const callouts = Array.from(
      fixture.nativeElement.querySelectorAll("bit-callout"),
    ) as HTMLElement[];
    expect(callouts.length).toBe(1 + params.savedUris!.length);
  });

  it("renders formatted hostnames into the DOM text", () => {
    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, " ");
    expect(text).toContain("example.com");
    expect(text).toContain("one.example.com");
    expect(text).toContain("two.example.com");
  });

  it("shows the 'show all' button when savedUrls > 1", () => {
    const btn = findShowAll();
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toContain("showAll");
  });

  it('hides the "show all" button when savedUrls is empty', async () => {
    const newParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://bitwarden.com/help",
      savedUris: [],
    };

    const { fixture: vf } = await createFreshFixture({ params: newParams });
    vf.detectChanges();
    const btn = findShowAll(vf);
    expect(btn).toBeNull();
  });

  it("handles toggling of the 'show all' button correctly", async () => {
    const { fixture: vf, component: vc } = await createFreshFixture();

    let btn = findShowAll(vf);
    expect(btn).toBeTruthy();
    expect(vc.savedUrlsExpanded()).toBe(false);
    expect(btn!.textContent).toContain("showAll");

    // click to expand
    btn!.click();
    vf.detectChanges();

    btn = findShowAll(vf);
    expect(btn!.textContent).toContain("showLess");
    expect(vc.savedUrlsExpanded()).toBe(true);

    // click to collapse
    btn!.click();
    vf.detectChanges();

    btn = findShowAll(vf);
    expect(btn!.textContent).toContain("showAll");
    expect(vc.savedUrlsExpanded()).toBe(false);
  });

  it("shows autofillOnly text on autofill button when viewOnly is false", () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text.includes("autofillOnly")).toBe(true);
  });

  it("does not show autofillOnly text on autofill button when viewOnly is true", async () => {
    const { fixture: vf } = await createFreshFixture({ viewOnly: true });
    const text = vf.nativeElement.textContent as string;
    expect(text.includes("autofillOnly")).toBe(false);
  });

  it("shows autofill and save button when viewOnly is false", () => {
    // default viewOnly is false
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text.includes("autofillAndSaveThisSite")).toBe(true);
  });

  it("does not show autofill and save button when viewOnly is true", async () => {
    const { fixture: vf } = await createFreshFixture({ viewOnly: true });
    const text = vf.nativeElement.textContent as string;
    expect(text.includes("autofillAndSaveThisSite")).toBe(false);
  });

  describe("dialogTitle()", () => {
    it("returns loginHasNoSiteSaved when no URIs are saved", async () => {
      const { component: c } = await createFreshFixture({
        params: { currentUrl: "https://example.com", savedUris: [] },
      });
      expect(c.dialogTitle()).toBe("loginHasNoSiteSaved");
    });

    it("returns siteDoesntMatch when 1 URI is saved", () => {
      expect(component.dialogTitle()).toBe("siteDoesntMatch");
    });

    it("returns siteDoesntMatch when multiple URIs are saved", async () => {
      const { component: c } = await createFreshFixture();
      expect(c.dialogTitle()).toBe("siteDoesntMatch");
    });
  });

  describe("dialogBody()", () => {
    it("returns loginNoSiteDesc when no URIs are saved", async () => {
      const { component: c } = await createFreshFixture({
        params: { currentUrl: "https://example.com", savedUris: [] },
      });
      expect(c.dialogBody()).toBe("loginNoSiteDesc");
    });

    it("returns loginSingleSiteDesc when 1 URI is saved", async () => {
      const { component: c } = await createFreshFixture({
        params: { currentUrl: "https://example.com", savedUris: [makeUri("https://other.com")] },
      });
      expect(c.dialogBody()).toBe("loginSingleSiteDesc");
    });

    it("returns loginMultipleSitesDesc when multiple URIs are saved", () => {
      expect(component.dialogBody()).toBe("loginMultipleSitesDesc");
    });
  });

  describe("accessibility", () => {
    it("URI display divs are keyboard focusable via tabindex", async () => {
      const singleUriParams: AutofillConfirmationDialogParams = {
        currentUrl: "https://example.com/path",
        savedUris: [makeUri("https://saved.example.com/login")],
      };
      const { fixture: vf } = await createFreshFixture({ params: singleUriParams });
      const savedDivs = vf.nativeElement.querySelectorAll(
        '[data-testid="saved-uri"]',
      ) as NodeListOf<HTMLElement>;
      const currentDiv = vf.nativeElement.querySelector(
        '[data-testid="current-uri"]',
      ) as HTMLElement;
      expect(savedDivs.length).toBe(1);
      expect(savedDivs[0].getAttribute("tabindex")).toBe("0");
      expect(currentDiv).toBeTruthy();
      expect(currentDiv.getAttribute("tabindex")).toBe("0");
    });

    it("saved URI div has aria-label with the full URI", async () => {
      const singleUriParams: AutofillConfirmationDialogParams = {
        currentUrl: "https://example.com/path",
        savedUris: [makeUri("https://saved.example.com/login")],
      };
      const { fixture: vf } = await createFreshFixture({ params: singleUriParams });
      const savedDiv = vf.nativeElement.querySelector('[data-testid="saved-uri"]') as HTMLElement;
      expect(savedDiv.getAttribute("aria-label")).toBe("https://saved.example.com/login");
    });

    it("current URL div has aria-label with the full URL", async () => {
      const singleUriParams: AutofillConfirmationDialogParams = {
        currentUrl: "https://example.com/path?q=1",
        savedUris: [makeUri("https://saved.example.com")],
      };
      const { fixture: vf } = await createFreshFixture({ params: singleUriParams });
      const currentDiv = vf.nativeElement.querySelector(
        '[data-testid="current-uri"]',
      ) as HTMLElement;
      expect(currentDiv.getAttribute("aria-label")).toBe("https://example.com/path?q=1");
    });

    it("multiple saved URI divs each have aria-label with their full URI", () => {
      const savedDivs = fixture.nativeElement.querySelectorAll(
        '[data-testid="saved-uri"]',
      ) as NodeListOf<HTMLElement>;
      expect(savedDivs.length).toBe(3);
      expect(savedDivs[0].getAttribute("aria-label")).toBe("https://one.example.com/a");
      expect(savedDivs[1].getAttribute("aria-label")).toBe("https://two.example.com/b");
      expect(savedDivs[2].getAttribute("aria-label")).toBe("https://three.example.com/c");
    });

    it("shows full URIs when strategy is Exact", async () => {
      const { component: c } = await createFreshFixture({
        uriMatchStrategy: UriMatchStrategy.Exact,
      });
      expect(c.showFullUrls()).toBe(true);
      expect(c.formattedCurrentUrl()).toBe("https://example.com/path?q=1");
      expect(c.formattedSavedUrls()).toEqual([
        "https://one.example.com/a",
        "https://two.example.com/b",
        "https://three.example.com/c",
      ]);
    });
  });
});
