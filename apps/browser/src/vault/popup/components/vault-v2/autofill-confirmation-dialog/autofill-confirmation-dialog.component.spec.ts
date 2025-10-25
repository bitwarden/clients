import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";

import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import {
  AutofillConfirmationDialogComponent,
  AutofillConfirmationDialogResult,
  AutofillConfirmationDialogParams,
} from "./autofill-confirmation-dialog.component";

describe("AutofillConfirmationDialogComponent", () => {
  let fixture: ComponentFixture<AutofillConfirmationDialogComponent>;
  let component: AutofillConfirmationDialogComponent;

  const dialogRef = {
    close: jest.fn(),
  } as unknown as DialogRef;

  const params: AutofillConfirmationDialogParams = {
    currentUrl: "https://example.com/path?q=1",
    savedUrls: ["https://one.example.com/a", "https://two.example.com/b", "not-a-url.example"],
    uriMatchStrategy: UriMatchStrategy.Host,
  };

  beforeEach(async () => {
    jest.spyOn(Utils, "getHostname").mockImplementation((value: string | null | undefined) => {
      if (typeof value !== "string" || !value) {
        return "";
      }
      try {
        // handle non-URL host strings gracefully
        if (!value.includes("://")) {
          return value;
        }
        return new URL(value).hostname;
      } catch {
        return "";
      }
    });

    await TestBed.configureTestingModule({
      imports: [AutofillConfirmationDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: {} },
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

  it("normalizes currentUrl and savedUrls via Utils.getHostname", () => {
    expect(Utils.getHostname).toHaveBeenCalledTimes(1 + (params.savedUrls?.length ?? 0));
    // current
    expect(component.currentUrl).toBe("example.com");
    // saved
    expect(component.savedUrls).toEqual([
      "one.example.com",
      "two.example.com",
      "not-a-url.example",
    ]);
  });

  it("renders normalized values into the template (shallow check)", () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("example.com");
    expect(text).toContain("one.example.com");
    expect(text).toContain("two.example.com");
    expect(text).toContain("not-a-url.example");
  });

  it("emits Canceled on close()", () => {
    const spy = jest.spyOn(dialogRef, "close");
    component["close"]();
    expect(spy).toHaveBeenCalledWith(AutofillConfirmationDialogResult.Canceled);
  });

  it("emits AutofillAndUrlAdded on autofillAndAddUrl()", () => {
    const spy = jest.spyOn(dialogRef, "close");
    component["autofillAndAddUrl"]();
    expect(spy).toHaveBeenCalledWith(AutofillConfirmationDialogResult.AutofillAndUrlAdded);
  });

  it("emits AutofilledOnly on autofillOnly()", () => {
    const spy = jest.spyOn(dialogRef, "close");
    component["autofillOnly"]();
    expect(spy).toHaveBeenCalledWith(AutofillConfirmationDialogResult.AutofilledOnly);
  });

  it("applies collapsed list gradient class by default, then clears it after viewAllSavedUrls()", () => {
    const initial = component["savedUrlsListClass"];
    expect(initial).toContain("gradient");

    component["viewAllSavedUrls"]();
    fixture.detectChanges();

    const expanded = component["savedUrlsListClass"];
    expect(expanded).toBe("");
  });

  it("handles empty savedUrls gracefully", async () => {
    const newParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://bitwarden.com/help",
      savedUrls: [],
    };

    const newFixture = TestBed.createComponent(AutofillConfirmationDialogComponent);
    const newInstance = newFixture.componentInstance;

    (newInstance as any).params = newParams;
    const fresh = new AutofillConfirmationDialogComponent(
      newParams as any,
      dialogRef,
    ) as AutofillConfirmationDialogComponent;

    expect(fresh.savedUrls).toEqual([]);
    expect(fresh.currentUrl).toBe("bitwarden.com");
  });

  it("handles undefined savedUrls by defaulting to [] and empty strings from Utils.getHostname", () => {
    const localParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://sub.domain.tld/x",
    };

    const local = new AutofillConfirmationDialogComponent(localParams as any, dialogRef);

    expect(local.savedUrls).toEqual([]);
    expect(local.currentUrl).toBe("sub.domain.tld");
  });

  it("filters out falsy/invalid values from Utils.getHostname in savedUrls", () => {
    (Utils.getHostname as jest.Mock).mockImplementationOnce(() => "example.com");
    (Utils.getHostname as jest.Mock)
      .mockImplementationOnce(() => "ok.example")
      .mockImplementationOnce(() => "")
      .mockImplementationOnce(() => undefined as unknown as string);

    const edgeParams: AutofillConfirmationDialogParams = {
      currentUrl: "https://example.com",
      savedUrls: ["https://ok.example", "://bad", "%%%"],
    };

    const edge = new AutofillConfirmationDialogComponent(edgeParams as any, dialogRef);

    expect(edge.currentUrl).toBe("example.com");
    expect(edge.savedUrls).toEqual(["ok.example"]);
  });

  it("renders one current-url callout and N saved-url callouts", () => {
    const callouts = Array.from(
      fixture.nativeElement.querySelectorAll("bit-callout"),
    ) as HTMLElement[];
    expect(callouts.length).toBe(1 + params.savedUrls!.length);
  });

  it("renders normalized hostnames into the DOM text", () => {
    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, " ");
    expect(text).toContain("example.com");
    expect(text).toContain("one.example.com");
    expect(text).toContain("two.example.com");
  });

  it("shows the 'view all' button when savedUrls > 1 and hides it after click", () => {
    const findViewAll = () =>
      fixture.nativeElement.querySelector(
        "button.tw-text-sm.tw-font-bold.tw-cursor-pointer",
      ) as HTMLButtonElement | null;

    let btn = findViewAll();
    expect(btn).toBeTruthy();

    btn!.click();
    fixture.detectChanges();

    btn = findViewAll();
    expect(btn).toBeFalsy();
    expect(component.savedUrlsExpanded).toBe(true);
  });
  it("highlights only the differing version segment at the start of the path (v2 vs v1)", () => {
    const params: AutofillConfirmationDialogParams = {
      currentUrl: "https://x.example.com/v2/some-path",
      savedUrls: ["https://x.example.com/v1/some-path"],
      uriMatchStrategy: UriMatchStrategy.Exact,
    };

    const cmp = new AutofillConfirmationDialogComponent(params as any, dialogRef);

    expect((cmp as any).currentTailDiff).toBe("v2");
    expect((cmp as any).currentSuffix).toBe("/some-path");

    const rows = (cmp as any).savedTailDiffs as Array<{
      host: string;
      diffSeg: string;
      suffix: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ host: "x.example.com", diffSeg: "v1", suffix: "/some-path" });
  });

  it.only("when saved extends current (prefix case), highlights only the extra segment on saved", () => {
    const params: AutofillConfirmationDialogParams = {
      currentUrl: "https://x.example.com/somepath",
      savedUrls: ["https://x.example.com/somepath/andmore"],
      uriMatchStrategy: UriMatchStrategy.Exact,
    };

    const cmp = new AutofillConfirmationDialogComponent(params as any, dialogRef);

    expect((cmp as any).currentTailDiff).toBe(""); // no highlight on current
    expect((cmp as any).currentSuffix).toBe("");

    const rows = (cmp as any).savedTailDiffs as Array<{
      host: string;
      diffSeg: string;
      suffix: string;
    }>;
    expect(rows).toEqual([{ host: "x.example.com", diffSeg: "/andmore", suffix: "" }]);
  });

  it("mid-path segment diff: highlights only that segment up to next '/'", () => {
    const params: AutofillConfirmationDialogParams = {
      currentUrl: "https://x.example.com/products/alpha/details",
      savedUrls: ["https://x.example.com/products/beta/details"],
      uriMatchStrategy: UriMatchStrategy.Exact,
    };

    const cmp = new AutofillConfirmationDialogComponent(params as any, dialogRef);

    expect((cmp as any).currentTailDiff).toBe("alpha");
    expect((cmp as any).currentSuffix).toBe("/details");

    const rows = (cmp as any).savedTailDiffs as Array<{ diffSeg: string; suffix: string }>;
    expect(rows[0].diffSeg).toBe("beta");
    expect(rows[0].suffix).toBe("/details");
  });

  it("host filtering: excludes non-matching hosts before diffing", () => {
    const params: AutofillConfirmationDialogParams = {
      currentUrl: "https://accounts.example.com/v2/a",
      savedUrls: [
        "https://mail.example.com/v2/a", // exclude
        "https://accounts.example.com/v1/a", // keep
        "https://other.example.com/v1/a", // exclude
      ],
      uriMatchStrategy: UriMatchStrategy.Exact,
    };

    const cmp = new AutofillConfirmationDialogComponent(params as any, dialogRef);

    // Only same-host remains
    expect(cmp.savedUrls).toEqual(["accounts.example.com"]);

    const rows = (cmp as any).savedTailDiffs as Array<{
      host: string;
      diffSeg: string;
      suffix: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ host: "accounts.example.com", diffSeg: "v1", suffix: "/a" });

    expect((cmp as any).currentTailDiff).toBe("v2");
    expect((cmp as any).currentSuffix).toBe("/a");
  });

  it("shared first-diff index aligns rows even when later segments diverge", () => {
    const params: AutofillConfirmationDialogParams = {
      currentUrl: "https://x.example.com/api/v2/users/123",
      savedUrls: [
        "https://x.example.com/api/v1/users/123",
        "https://x.example.com/api/v1/users/999",
      ],
      uriMatchStrategy: UriMatchStrategy.Exact,
    };

    const cmp = new AutofillConfirmationDialogComponent(params as any, dialogRef);

    expect((cmp as any).currentTailDiff).toBe("v2");
    expect((cmp as any).currentSuffix).toBe("/users/123");

    const diffs = ((cmp as any).savedTailDiffs as Array<{ diffSeg: string; suffix: string }>).map(
      (d) => d.diffSeg,
    );
    expect(diffs).toEqual(["v1", "v1"]);
  });
});
