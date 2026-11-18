import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import {
  AccessRequestSdkService,
  LeasingErrorService,
  REQUEST_ACCESS_SERVER_ERRORS,
  composeRequestWindow,
  toDateInputValue,
} from "@bitwarden/bit-pam";
import type { AccessPreCheckView, RequestWindowFormValue } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { REQUEST_WINDOW_ERROR_KEY } from "../request-window-fields/request-access-window.validators";
import { RequestWindowFieldsComponent } from "../request-window-fields/request-window-fields.component";

import { RequestAccessFormComponent } from "./request-access-form.component";

/** Tomorrow, anchored to the real clock, since the window validator rejects an ended window. */
const futureDate = toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));

function preCheck(overrides: Partial<AccessPreCheckView> = {}): AccessPreCheckView {
  return {
    cipherId: "cipher-1",
    approvalMode: "automatic",
    hasActiveLease: false,
    // The SDK always resolves both bounds on a pre-check.
    defaultDurationSeconds: 3600,
    maxDurationSeconds: 86_400,
    // The SDK reads an absent canStartLease as true, so the resting fixture is the startable case.
    canStartLease: true,
    ...overrides,
  } as unknown as AccessPreCheckView;
}

describe("RequestAccessFormComponent", () => {
  let fixture: ComponentFixture<RequestAccessFormComponent>;
  let component: RequestAccessFormComponent;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasingErrors: MockProxy<LeasingErrorService>;
  let toastService: MockProxy<ToastService>;
  let platformUtils: MockProxy<PlatformUtilsService>;
  let accessChanged: jest.Mock;

  /** Mounts the form and lets its pre-check land. */
  async function create(): Promise<void> {
    fixture = TestBed.createComponent(RequestAccessFormComponent);
    fixture.componentRef.setInput("cipherId", "cipher-1");
    component = fixture.componentInstance;
    accessChanged = jest.fn();
    component.accessChanged.subscribe(accessChanged);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function queryAll(selector: string): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as HTMLElement[];
  }

  function windowFields(): RequestWindowFieldsComponent {
    return fixture.debugElement.query(By.directive(RequestWindowFieldsComponent))
      .componentInstance as RequestWindowFieldsComponent;
  }

  /** Types a window into the human path's fields and, when given, a reason beside them. */
  function fillHumanForm({
    reason,
    ...window
  }: { [K in keyof RequestWindowFormValue]-?: string } & { reason?: string }): void {
    windowFields()["form"].patchValue(window);
    if (reason != null) {
      component["humanForm"].controls.reason.setValue(reason);
    }
  }

  function reasonHint(textareaId: string): HTMLElement | null {
    return (query(textareaId)?.closest("bit-form-field")?.querySelector("bit-hint") ??
      null) as HTMLElement | null;
  }

  function endFieldError(): HTMLElement | null {
    return (query("#pam-cipher-view-banner_input_end")
      ?.closest("bit-form-field")
      ?.querySelector("bit-error") ?? null) as HTMLElement | null;
  }

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    leasingErrors = mock<LeasingErrorService>();
    toastService = mock<ToastService>();
    platformUtils = mock<PlatformUtilsService>();

    requestsApi.preCheck.mockResolvedValue(preCheck());
    leasingErrors.isLeasingError.mockReturnValue(false);
    // jsdom does no layout, so it has no scrollIntoView for an invalid submit to call.
    Element.prototype.scrollIntoView = jest.fn();

    TestBed.configureTestingModule({
      imports: [RequestAccessFormComponent],
      providers: [
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: LeasingErrorService, useValue: leasingErrors },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: platformUtils },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  describe("the form", () => {
    it("hints the duration and marks it required on the automatic path too", async () => {
      await create();

      expect(text()).toContain("requestAccessModalDurationHint");
      expect(text()).toContain("requestAccessModalAutomaticReasonHintV2");
      expect(query("#pam-cipher-view-banner_select_duration")?.hasAttribute("required")).toBe(true);
      expect(query("#pam-cipher-view-banner_button_automatic-reason-copy")).not.toBeNull();
    });

    it("copies the reason through the platform service", async () => {
      await create();

      component["automaticForm"].patchValue({ reason: "Quarterly audit" });
      query("#pam-cipher-view-banner_button_automatic-reason-copy")?.click();

      expect(platformUtils.copyToClipboard).toHaveBeenCalledWith("Quarterly audit");
    });

    it("shapes the form from the pre-check's automatic path", async () => {
      await create();

      expect(requestsApi.preCheck).toHaveBeenCalledWith("cipher-1");
      expect(component["requestMode"]()).toBe("automatic");
      expect(query("#pam-cipher-view-banner_select_duration")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_input_start-date")).toBeNull();
    });

    it("shapes the form from the pre-check's human path and seeds the window", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      expect(component["requestMode"]()).toBe("human");
      expect(query("#pam-cipher-view-banner_input_start-date")).not.toBeNull();
      expect(component["humanForm"].getRawValue().window?.startDate).not.toBe("");
      expect(component["humanForm"].getRawValue().window?.startTime).not.toBe("");
    });

    it("renders the automatic path's Reason field as a multi-line textarea", async () => {
      await create();

      const reason = query("#pam-cipher-view-banner_textarea_automatic-reason");
      expect(reason?.tagName).toBe("TEXTAREA");
      expect(reason?.getAttribute("rows")).toBe("3");
    });

    it("hints the automatic path's Reason without naming an approver", async () => {
      await create();

      expect(
        reasonHint("#pam-cipher-view-banner_textarea_automatic-reason")?.textContent,
      ).toContain("requestAccessModalAutomaticReasonHintV2");
    });

    it("renders the human path's Reason field as a multi-line textarea", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      const reason = query("#pam-cipher-view-banner_textarea_human-reason");
      expect(reason?.tagName).toBe("TEXTAREA");
      expect(reason?.getAttribute("rows")).toBe("3");
    });

    it("keeps the approver hint on the human path's Reason", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      expect(reasonHint("#pam-cipher-view-banner_textarea_human-reason")?.textContent).toContain(
        "requestAccessModalHumanReasonHintV2",
      );
    });

    it("narrows the duration picker to the rule's maximum", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ defaultDurationSeconds: 900, maxDurationSeconds: 1800 }),
      );
      await create();

      expect(component["durationOptions"]().map((o) => o.seconds)).toEqual([900, 1800]);
      const rendered = queryAll("#pam-cipher-view-banner_select_duration option").map((o) =>
        o.textContent?.trim(),
      );
      expect(rendered).toHaveLength(2);
    });

    it("pre-selects the rule's default duration rather than a hardcoded hour", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ defaultDurationSeconds: 900, maxDurationSeconds: 1800 }),
      );
      await create();

      expect(component["automaticForm"].getRawValue().durationSeconds).toBe(900);
    });

    it("seeds the human path's window from the rule's default duration", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "human", defaultDurationSeconds: 900, maxDurationSeconds: 1800 }),
      );
      await create();

      // Composed from the form's open time, not a fixed date.
      const window = composeRequestWindow(component["humanForm"].getRawValue().window!);
      const spanMinutes = (window!.end.getTime() - window!.start.getTime()) / 60_000;
      expect(spanMinutes).toBe(15);
    });

    it("reports a change without asking when the pre-check finds a lease raced in", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ hasActiveLease: true }));
      await create();

      expect(accessChanged).toHaveBeenCalled();
    });

    it("surfaces a generic error when the pre-check fails", async () => {
      requestsApi.preCheck.mockRejectedValue(new Error("boom"));
      await create();

      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
      expect(component["requestMode"]()).toBeNull();
    });

    it("words the rule's cap for each approval path, for the host's summary", async () => {
      await create();
      expect(component.terms()).toEqual({
        maxSeconds: 86_400,
        messageKey: "pamRequestAccessBannerMaxDurationAutomatic",
      });

      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "human", maxDurationSeconds: 4 * 3600 }),
      );
      await create();
      expect(component.terms()).toEqual({
        maxSeconds: 4 * 3600,
        messageKey: "pamRequestAccessBannerMaxDuration",
      });
    });

    describe("when another member holds the single-active-lease slot", () => {
      it("warns with the time the slot frees, in place of the immediate-access copy", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ canStartLease: false, slotFreesAt: "2026-08-31T10:52:00Z" }),
        );
        await create();

        expect(text()).toContain("pamRequestSlotTakenUntil");
      });

      it("warns without a time when the server does not say when it frees", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ canStartLease: false, slotFreesAt: undefined }),
        );
        await create();

        expect(text()).toContain("pamRequestSlotTaken");
        expect(text()).not.toContain("pamRequestSlotTakenUntil");
      });

      it("leaves the form submittable, because contention is a manual retry", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ canStartLease: false, slotFreesAt: "2026-08-31T10:52:00Z" }),
        );
        await create();

        expect(query("#pam-cipher-view-banner_select_duration")).not.toBeNull();
        expect(component.requestMode()).toBe("automatic");
      });

      it("stays quiet on the human path, whose window is not now", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({
            approvalMode: "human",
            canStartLease: false,
            slotFreesAt: "2026-08-31T10:52:00Z",
          }),
        );
        await create();

        expect(component["slotContention"]()).toBeNull();
        expect(text()).not.toContain("pamRequestSlotTaken");
        expect(text()).toContain("requestAccessModalStartDate");
      });
    });
  });

  describe("submitting a request", () => {
    it("sends only a duration on the automatic path", async () => {
      requestsApi.submitAccessRequest.mockResolvedValue({ approvalMode: "automatic" } as never);
      await create();

      component["automaticForm"].patchValue({ durationSeconds: 1800, reason: "  " });
      await component["submitRequest"]();

      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: 1800,
        start: undefined,
        end: undefined,
        // A blank reason is optional on this path and must not be sent as an empty string.
        reason: undefined,
      });
      expect(accessChanged).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("sends a window and reason on the human path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      requestsApi.submitAccessRequest.mockResolvedValue({ approvalMode: "human" } as never);
      await create();

      fillHumanForm({
        startDate: futureDate,
        startTime: "09:00",
        endDate: futureDate,
        endTime: "10:00",
        reason: " prod incident ",
      });
      await component["submitRequest"]();

      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: undefined,
        start: new Date(`${futureDate}T09:00`).toISOString(),
        end: new Date(`${futureDate}T10:00`).toISOString(),
        reason: "prod incident",
      });
    });

    it("sends a window spanning several days", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "human", maxDurationSeconds: 7 * 24 * 60 * 60 }),
      );
      requestsApi.submitAccessRequest.mockResolvedValue({ approvalMode: "human" } as never);
      await create();

      const [year, month, day] = futureDate.split("-").map(Number);
      const endDate = toDateInputValue(new Date(year, month - 1, day + 2));
      fillHumanForm({
        startDate: futureDate,
        startTime: "23:00",
        endDate,
        endTime: "01:00",
        reason: "overnight cutover",
      });
      await component["submitRequest"]();

      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: undefined,
        start: new Date(`${futureDate}T23:00`).toISOString(),
        end: new Date(`${endDate}T01:00`).toISOString(),
        reason: "overnight cutover",
      });
    });

    it("re-checks the window on submit when it elapsed while the form sat open", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      const end = windowFields()["form"].controls.endTime;
      fillHumanForm({
        startDate: futureDate,
        startTime: "09:00",
        endDate: futureDate,
        endTime: "10:00",
        reason: "prod incident",
      });
      expect(end.errors).toBeNull();

      // Ages the form past its window without touching a control; only submit re-validates.
      jest.useFakeTimers().setSystemTime(new Date(`${futureDate}T10:00`).getTime() + 1000);
      try {
        expect(end.errors).toBeNull();

        await component["submitRequest"]();

        expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
        expect(end.errors?.[REQUEST_WINDOW_ERROR_KEY]).toEqual(
          expect.objectContaining({ problem: "endInPast" }),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it("does not submit an invalid human form", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      fillHumanForm({
        startDate: futureDate,
        startTime: "10:00",
        endDate: futureDate,
        endTime: "10:00",
        reason: "",
      });
      await component["submitRequest"]();

      expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
    });

    it("scrolls a missing reason's error into view rather than leave it below the fold", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      fillHumanForm({
        startDate: futureDate,
        startTime: "09:00",
        endDate: futureDate,
        endTime: "10:00",
        reason: "",
      });
      await component.submitRequest();
      fixture.detectChanges();

      const scrollIntoView = jest.mocked(Element.prototype.scrollIntoView);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
      expect(scrollIntoView.mock.contexts).toEqual([
        query("#pam-cipher-view-banner_textarea_human-reason")?.closest("bit-form-field"),
      ]);
    });

    it("reveals the window error on submit rather than submitting", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();
      windowFields()["endDuration"].setValue("custom");
      fixture.detectChanges();
      await fixture.whenStable();

      fillHumanForm({
        startDate: futureDate,
        startTime: "10:00",
        endDate: futureDate,
        endTime: "10:00",
        reason: "prod incident",
      });
      await component["submitRequest"]();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
      const error = endFieldError();
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("requestAccessModalEndNotAfterStart");
    });
  });

  describe("reconciling a rejected submit", () => {
    async function submitAndFail(message: string): Promise<void> {
      const error = Object.assign(new Error(message), {
        name: "AccessRequestError",
        variant: "Api",
      });
      leasingErrors.isLeasingError.mockReturnValue(true);
      requestsApi.submitAccessRequest.mockRejectedValue(error);
      await create();
      await component["submitRequest"]();
    }

    // A real rule cap, since the server interpolates its effective maximum.
    const windowExceedsMax = "The requested window exceeds the maximum of 604800 seconds.";

    /** The serialized `ErrorResponseModel` the SDK concatenates onto its transport string. */
    const wireBody = (serverMessage: string, exceptionMessage = serverMessage) =>
      `error in response: status code 400 Bad Request: {"object":"error",` +
      `"message":"${serverMessage}","validationErrors":null,` +
      `"exceptionMessage":"${exceptionMessage}","exceptionStackTrace":null}`;

    it("treats 'already pending' as information, reporting a change without an inline error", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.AlreadyPending);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "info",
        message: "requestAccessModalAlreadyPending",
      });
      expect(accessChanged).toHaveBeenCalled();
      expect(component["requestError"]()).toBeNull();
    });

    it("echoes a validation failure inline without reporting a change", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd);

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd);
      expect(accessChanged).not.toHaveBeenCalled();
    });

    // "7 days" is the 604800 the server sent, read back out of its sentence and localized.
    it("re-renders an over-long window in the requester's own language", async () => {
      await submitAndFail(windowExceedsMax);

      expect(component["requestError"]()).toBe("requestAccessModalWindowExceedsMax 7 days");
      expect(accessChanged).not.toHaveBeenCalled();
    });

    it("echoes an over-long duration rather than wording it as a window", async () => {
      const durationExceedsMax = "The requested duration exceeds the maximum of 1800 seconds.";
      await submitAndFail(durationExceedsMax);

      expect(component["requestError"]()).toBe(durationExceedsMax);
      expect(accessChanged).not.toHaveBeenCalled();
    });

    it("classifies on the server's message decoded out of the serialized response", async () => {
      await submitAndFail(wireBody(windowExceedsMax));

      expect(component["requestError"]()).toBe("requestAccessModalWindowExceedsMax 7 days");
      expect(accessChanged).not.toHaveBeenCalled();
    });

    it("ignores a catalog sentence carried elsewhere in the envelope", async () => {
      await submitAndFail(wireBody(windowExceedsMax, REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive));

      expect(component["requestError"]()).toBe("requestAccessModalWindowExceedsMax 7 days");
      expect(accessChanged).not.toHaveBeenCalled();
    });

    it("pins a missing reason to the reason control", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.ReasonRequired);

      expect(component["humanForm"].controls.reason.errors).toEqual({ required: true });
    });

    it("falls back to generic copy for an unrecognised failure", async () => {
      await submitAndFail("the server exploded");

      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
    });

    it("announces a network failure without the SDK's transport text", async () => {
      await submitAndFail("error in reqwest-middleware: error sending request");
      fixture.detectChanges();

      const error = query('[data-testid="request-error"]');
      expect(error?.getAttribute("role")).toBe("alert");
      expect(error?.textContent?.trim()).toBe("requestAccessModalGenericError");
    });
  });
});
