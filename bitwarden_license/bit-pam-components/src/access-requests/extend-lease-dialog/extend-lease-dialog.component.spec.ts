import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject, of } from "rxjs";

import { PamConnectivityService } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, TooltipDirective } from "@bitwarden/components";

import { ExtendLeaseDialogComponent } from "./extend-lease-dialog.component";

describe("ExtendLeaseDialogComponent", () => {
  let fixture: ComponentFixture<ExtendLeaseDialogComponent>;
  let offline$: BehaviorSubject<boolean>;
  const close = jest.fn();

  const SUBMIT = "#extend-lease-dialog_button_submit";

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ExtendLeaseDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: { maxDurationSeconds: 3600 } },
        { provide: DialogRef, useValue: { close } },
        { provide: PamConnectivityService, useValue: { offline$, reconnected$: of() } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ExtendLeaseDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance["formGroup"].controls.reason.setValue("incident still open");
    fixture.detectChanges();
  }

  function submitButton(): HTMLElement {
    return fixture.nativeElement.querySelector(SUBMIT);
  }

  function submitTooltip(): string {
    return fixture.debugElement
      .query(By.css(SUBMIT))
      .injector.get(TooltipDirective)
      .tooltipContent()
      .trim();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    offline$ = new BehaviorSubject(false);
  });

  it("enables Extend online and closes with the request", async () => {
    await create();

    expect(submitButton().getAttribute("aria-disabled")).toBeNull();
    expect(submitTooltip()).toBe("");
    await fixture.componentInstance["submit"]();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ reason: "incident still open" }));
  });

  it("disables Extend offline, saying why, and closes with nothing", async () => {
    await create();

    offline$.next(true);
    fixture.detectChanges();

    expect(submitButton().getAttribute("aria-disabled")).toBe("true");
    expect(submitTooltip()).toBe("pamOfflineTooltip");
    await fixture.componentInstance["submit"]();
    expect(close).not.toHaveBeenCalled();
  });
});
