import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";

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
});
