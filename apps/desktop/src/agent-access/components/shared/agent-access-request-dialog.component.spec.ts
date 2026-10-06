import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AsyncActionsModule, ButtonModule, DialogRef } from "@bitwarden/components";

import { AgentAccessConsequence } from "../../models/agent-access-consequence";

import { AgentAccessRequestDialogComponent } from "./agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./agent-access-requester.component";

/**
 * `AgentAccessRequestDialogComponent` puts `<bit-dialog>` as its *own* nested element and
 * re-projects the footer twice (consumer → this shell's `[dialogFooter]` slot →
 * `bit-dialog`'s `[bitDialogFooter]` slot). Six of the nine dialogs being migrated onto this
 * shell are `<form [bitSubmit] [formGroup] bit-dialog>` today, where `bitFormButton` footer
 * buttons resolve `BitSubmitDirective` through Angular's element-injector chain — the concern
 * (agent-access-design-spec.md §3.1) is that the extra layers of `<ng-content>` break that
 * resolution. This suite proves, with real rendered fixtures, that it doesn't — see
 * `agent-access-request-dialog.component.ts`'s class doc comment for *why* it doesn't.
 */

@Component({
  selector: "test-form-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    AgentAccessRequestDialogComponent,
  ],
  template: `
    <form [formGroup]="form" [bitSubmit]="submit">
      <app-agent-access-request-dialog
        [dialogTitle]="'Approve request'"
        [requester]="requester"
        [grade]="grade"
        [consequenceSummary]="'creates a new secret in your vault'"
      >
        <div data-testid="body">dialog-specific body</div>
        <ng-container dialogFooter>
          <button
            id="test-form-host_button_submit"
            type="submit"
            bitButton
            bitFormButton
            buttonType="primary"
            [disabled]="submitButtonDisabled"
          >
            Approve
          </button>
          <button
            id="test-form-host_button_cancel"
            type="button"
            bitButton
            bitFormButton
            buttonType="secondary"
            (click)="cancelClicks = cancelClicks + 1"
          >
            Cancel
          </button>
        </ng-container>
      </app-agent-access-request-dialog>
    </form>
  `,
})
class FormHostComponent {
  readonly form = new FormBuilder().group({});
  readonly requester: AgentAccessRequesterView = { name: "Claude Code" };
  readonly grade: AgentAccessConsequence = AgentAccessConsequence.Change;
  submitButtonDisabled = false;
  submitCalls = 0;
  cancelClicks = 0;

  private resolveSubmit?: () => void;

  readonly submit = () =>
    new Promise<void>((resolve) => {
      this.submitCalls++;
      this.resolveSubmit = resolve;
    });

  finishSubmit(): void {
    this.resolveSubmit?.();
    this.resolveSubmit = undefined;
  }
}

@Component({
  selector: "test-non-form-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncActionsModule, ButtonModule, AgentAccessRequestDialogComponent],
  template: `
    <app-agent-access-request-dialog
      [dialogTitle]="'Permanently delete this secret?'"
      [requester]="requester"
      [grade]="grade"
      [consequenceSummary]="'permanently deletes DB_PASSWORD'"
      [dialogSize]="'large'"
    >
      <div data-testid="body">dialog-specific body</div>
      <ng-container dialogFooter>
        <button
          id="test-non-form-host_button_authorize"
          type="button"
          bitButton
          buttonType="danger"
          [bitAction]="authorize"
        >
          Delete
        </button>
      </ng-container>
    </app-agent-access-request-dialog>
  `,
})
class NonFormHostComponent {
  readonly requester: AgentAccessRequesterView = { name: "Claude Code" };
  readonly grade: AgentAccessConsequence = AgentAccessConsequence.Destroy;
  authorizeCalls = 0;

  readonly authorize = async () => {
    this.authorizeCalls++;
  };
}

describe("AgentAccessRequestDialogComponent", () => {
  let mockDialogRef: MockProxy<DialogRef>;

  beforeAll(() => {
    // jsdom does not implement IntersectionObserver; bit-dialog's scroll-shadow logic uses it
    // internally (mirrors the same polyfill in offboarding-survey.component.spec.ts).
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  });

  function configureTestBed(imports: unknown[]) {
    mockDialogRef = mock<DialogRef>();
    // jest-mock-extended proxies every unknown property access, including plain (non-method)
    // properties, as a mock function — which is truthy. DialogComponent's template checks
    // `!dialogRef?.disableClose` to decide whether to render its close button, so leaving this
    // unset would silently hide the close button and defeat the DialogRef assertions below.
    mockDialogRef.disableClose = false;
    // Same jest-mock-extended gotcha as above: DialogComponent branches on
    // `dialogRef?.isDrawer` to decide whether closing goes through DrawerService or
    // `dialogRef.close()` directly — an unset (mock-function-valued) `isDrawer` would route
    // through the wrong branch and never call `close()`.
    mockDialogRef.isDrawer = false;
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    return TestBed.configureTestingModule({
      imports: imports as never,
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();
  }

  describe("form-wrapped consumer (six of the nine dialogs)", () => {
    let fixture: ComponentFixture<FormHostComponent>;
    let component: FormHostComponent;

    const submitButton = () =>
      fixture.debugElement.query(By.css("#test-form-host_button_submit"))
        .nativeElement as HTMLButtonElement;
    const closeButton = () =>
      fixture.debugElement.query(By.css("button[biticonbutton='bwi-close']"))
        .nativeElement as HTMLButtonElement;

    beforeEach(async () => {
      await configureTestBed([FormHostComponent]);
      fixture = TestBed.createComponent(FormHostComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("defaults dialogSize to bit-dialog's own default when the shell consumer doesn't set it", () => {
      // FormHostComponent's template above deliberately never binds [dialogSize] — this proves
      // an existing shell consumer's rendering is unchanged unless it opts in.
      const section = fixture.nativeElement.querySelector("section") as HTMLElement;

      expect(section.className).toContain("md:tw-max-w-xl"); // bit-dialog's own "default" width class
      expect(section.className).not.toContain("md:tw-max-w-sm");
      expect(section.className).not.toContain("md:tw-max-w-3xl");
    });

    it("renders the requester, consequence band, and projected body in order", () => {
      const content = fixture.nativeElement.querySelector("[bitDialogContent]") as HTMLElement;
      const text = content.textContent ?? "";

      expect(text.indexOf("Claude Code")).toBeLessThan(
        text.indexOf("creates a new secret in your vault"),
      );
      expect(text.indexOf("creates a new secret in your vault")).toBeLessThan(
        text.indexOf("dialog-specific body"),
      );
    });

    it("resolves BitSubmitDirective through the shell's re-projected footer slot and fires submit on click", () => {
      submitButton().click();
      fixture.detectChanges();

      expect(component.submitCalls).toBe(1);
    });

    it("shows bitFormButton's loading state while the async submit is in flight, then clears it", fakeAsync(() => {
      submitButton().click();
      fixture.detectChanges();

      // BitSubmitDirective disables the form synchronously; BaseButtonDirective's disabledAttr
      // (loading || disabled) drives aria-disabled immediately, ahead of the debounced spinner.
      expect(submitButton().getAttribute("aria-disabled")).toBe("true");

      tick(100); // clear BaseButtonDirective's 75ms spinner-flash debounce
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("#test-form-host_button_submit bit-spinner")),
      ).not.toBeNull();

      component.finishSubmit();
      tick();
      fixture.detectChanges();
      tick(100);
      fixture.detectChanges();

      expect(submitButton().hasAttribute("aria-disabled")).toBe(false);
      expect(
        fixture.debugElement.query(By.css("#test-form-host_button_submit bit-spinner")),
      ).toBeNull();
    }));

    it("still applies a [disabled] binding on the projected submit button, blocking the click", () => {
      // The host is OnPush, and this mutates a plain field rather than going through an
      // Angular-bound DOM event, so it needs an explicit markForCheck (a click, used by every
      // other test in this suite, marks its view dirty automatically).
      const markDirty = () => fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();

      component.submitButtonDisabled = true;
      markDirty();
      fixture.detectChanges();

      expect(submitButton().getAttribute("aria-disabled")).toBe("true");

      // AriaDisabledClickCaptureService intercepts the click at the document level for any
      // `[aria-disabled="true"][bit-aria-disable="true"]` element, so a real click must not
      // reach the form.
      submitButton().click();
      fixture.detectChanges();

      expect(component.submitCalls).toBe(0);

      component.submitButtonDisabled = false;
      markDirty();
      fixture.detectChanges();

      expect(submitButton().hasAttribute("aria-disabled")).toBe(false);
    });

    it("leaves a plain click-bound footer button (not wired to the form) working alongside the submit button", () => {
      const cancel = fixture.debugElement.query(By.css("#test-form-host_button_cancel"))
        .nativeElement as HTMLButtonElement;

      cancel.click();
      fixture.detectChanges();

      expect(component.cancelClicks).toBe(1);
      expect(component.submitCalls).toBe(0);
    });

    it("leaves the nested bit-dialog's own DialogRef close behaviour unchanged", () => {
      closeButton().click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("non-form consumer (bitAction against a plain bit-dialog, e.g. confirm-delete-request)", () => {
    let fixture: ComponentFixture<NonFormHostComponent>;
    let component: NonFormHostComponent;

    const authorizeButton = () =>
      fixture.debugElement.query(By.css("#test-non-form-host_button_authorize"))
        .nativeElement as HTMLButtonElement;
    const closeButton = () =>
      fixture.debugElement.query(By.css("button[biticonbutton='bwi-close']"))
        .nativeElement as HTMLButtonElement;

    beforeEach(async () => {
      await configureTestBed([NonFormHostComponent]);
      fixture = TestBed.createComponent(NonFormHostComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("fires the bitAction footer button with no enclosing form", async () => {
      authorizeButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.authorizeCalls).toBe(1);
    });

    it("leaves the nested bit-dialog's own DialogRef close behaviour unchanged", () => {
      closeButton().click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });

    it("forwards an explicit dialogSize to the nested bit-dialog", () => {
      // NonFormHostComponent's template above binds [dialogSize]="'large'".
      const section = fixture.nativeElement.querySelector("section") as HTMLElement;

      expect(section.className).toContain("md:tw-max-w-3xl"); // bit-dialog's own "large" width class
      expect(section.className).not.toContain("md:tw-max-w-xl");
    });
  });
});
