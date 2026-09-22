import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  LeasingErrorService,
  REQUEST_ACCESS_SDK_ERRORS,
  REQUEST_ACCESS_SERVER_ERRORS,
  toDateInputValue,
} from "@bitwarden/bit-common/pam";
import type { AccessPreCheckView, AccessRequestView } from "@bitwarden/bit-common/pam";
import { REQUEST_WINDOW_ERROR_KEY } from "@bitwarden/bit-common/pam/helpers/request-access-window.validators";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import {
  RequestAccessDialogComponent,
  RequestAccessDialogParams,
} from "./request-access-dialog.component";

/**
 * Tomorrow, in the shape `<input type="date">` carries. Anchored to the real clock, since the window
 * validator rejects an already-ended window and a literal date would eventually start failing.
 */
const futureDate = toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));

function requestView(overrides: Partial<AccessRequestView> = {}): AccessRequestView {
  return { id: "request-1", ...overrides } as unknown as AccessRequestView;
}

function preCheck(overrides: Partial<AccessPreCheckView> = {}): AccessPreCheckView {
  return {
    cipherId: "cipher-1",
    approvalMode: "automatic",
    hasActiveLease: false,
    defaultDurationSeconds: 3600,
    maxDurationSeconds: 86_400,
    // The SDK reads an absent canStartLease as true, so the resting fixture is the startable case.
    canStartLease: true,
    ...overrides,
  } as unknown as AccessPreCheckView;
}

describe("RequestAccessDialogComponent", () => {
  let fixture: ComponentFixture<RequestAccessDialogComponent>;
  let component: RequestAccessDialogComponent;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let accessRefresh: MockProxy<AccessRefreshService>;
  let leasingErrors: MockProxy<LeasingErrorService>;
  let toastService: MockProxy<ToastService>;
  let dialogRef: MockProxy<DialogRef>;

  const params: RequestAccessDialogParams = { cipherId: "cipher-1", itemName: "Prod database" };

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(RequestAccessDialogComponent);
    component = fixture.componentInstance;
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

  function endFieldError(): HTMLElement | null {
    return (query("#pam-request-access-dialog_input_end")
      ?.closest("bit-form-field")
      ?.querySelector("bit-error") ?? null) as HTMLElement | null;
  }

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    accessRefresh = mock<AccessRefreshService>();
    leasingErrors = mock<LeasingErrorService>();
    toastService = mock<ToastService>();
    dialogRef = mock<DialogRef>();

    requestsApi.preCheck.mockResolvedValue(preCheck());
    leasingErrors.isLeasingError.mockReturnValue(false);

    TestBed.configureTestingModule({
      imports: [RequestAccessDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessRefreshService, useValue: accessRefresh },
        { provide: LeasingErrorService, useValue: leasingErrors },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("names the item under the title", async () => {
    await create();

    expect(text()).toContain("requestAccessModalTitle");
    expect(text()).toContain("Prod database");
  });

  it("pre-checks the cipher it was opened for", async () => {
    await create();

    expect(requestsApi.preCheck).toHaveBeenCalledWith("cipher-1");
  });

  describe("the pre-check", () => {
    it("shapes the form from the pre-check's automatic path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      await create();
      fixture.detectChanges();

      expect(requestsApi.preCheck).toHaveBeenCalledWith("cipher-1");
      expect(component["requestMode"]()).toBe("automatic");
      expect(query("#pam-request-access-dialog_select_duration")).not.toBeNull();
      expect(query("#pam-request-access-dialog_input_date")).toBeNull();
    });

    it("shapes the form from the pre-check's human path and seeds the window", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();
      fixture.detectChanges();

      expect(component["requestMode"]()).toBe("human");
      expect(query("#pam-request-access-dialog_input_date")).not.toBeNull();
      expect(query("#pam-request-access-dialog_input_start")).not.toBeNull();
      expect(query("#pam-request-access-dialog_input_end")).not.toBeNull();
      expect(component["humanForm"].controls.date.value).not.toBe("");
      expect(query("#pam-request-access-dialog_select_duration")).toBeNull();
    });

    it("narrows the duration picker to the rule's maximum", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({
          approvalMode: "automatic",
          maxDurationSeconds: 1800,
          defaultDurationSeconds: 900,
        }),
      );
      await create();
      fixture.detectChanges();

      const offered = component["durationOptions"]().map((option) => option.seconds);
      expect(offered.length).toBeGreaterThan(0);
      expect(Math.max(...offered)).toBeLessThanOrEqual(1800);
    });

    it("pre-selects the rule's default duration rather than a hardcoded hour", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "automatic", defaultDurationSeconds: 1800 }),
      );
      await create();

      expect(component["automaticForm"].controls.durationSeconds.value).toBe(1800);
      expect(component["durationOptions"]().map((o) => o.seconds)).toContain(1800);
    });

    it("floors the date picker at the day the dialog opened", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();
      fixture.detectChanges();

      expect(query("#pam-request-access-dialog_input_date")?.getAttribute("min")).toBe(
        toDateInputValue(new Date()),
      );
    });

    it("names the day a midnight-crossing window ends on", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      component["humanForm"].patchValue({ date: futureDate, start: "23:00", end: "01:00" });
      fixture.detectChanges();

      expect(query('[data-testid="request-window-next-day"]')).not.toBeNull();
    });

    it("says nothing about the next day for a window that stays on its date", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      component["humanForm"].patchValue({ date: futureDate, start: "09:00", end: "10:00" });
      fixture.detectChanges();

      expect(query('[data-testid="request-window-next-day"]')).toBeNull();
    });

    it("closes as reconciled without asking when the pre-check reports a lease raced in", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ hasActiveLease: true }));
      await create();

      expect(dialogRef.close).toHaveBeenCalledWith("reconciled");
      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalledWith("cipher-1");
      expect(component["requestMode"]()).toBeNull();
    });

    it("surfaces a generic error, and offers no submit, when the pre-check fails", async () => {
      requestsApi.preCheck.mockRejectedValue(new Error("boom"));
      await create();

      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
      expect(component["requestMode"]()).toBeNull();
      expect(query("#pam-request-access-dialog_button_submit")).toBeNull();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    describe("when another member holds the single-active-lease slot", () => {
      it("warns with the time the slot frees, in place of the immediate-access copy", async () => {
        const freesAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ approvalMode: "automatic", canStartLease: false, slotFreesAt: freesAt }),
        );
        await create();
        fixture.detectChanges();

        expect(text()).toContain("pamRequestSlotTakenUntil");
        expect(text()).not.toContain("requestAccessModalAutomaticDescription");
      });

      it("warns without a time when the server does not say when it frees", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ approvalMode: "automatic", canStartLease: false, slotFreesAt: undefined }),
        );
        await create();
        fixture.detectChanges();

        expect(text()).toContain("pamRequestSlotTaken");
      });

      it("leaves the form submittable, because contention is a manual retry", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ approvalMode: "automatic", canStartLease: false }),
        );
        await create();
        fixture.detectChanges();

        expect(query("#pam-request-access-dialog_button_submit")).not.toBeNull();
      });

      it("stays quiet on the human path, whose window is not now", async () => {
        requestsApi.preCheck.mockResolvedValue(
          preCheck({ approvalMode: "human", canStartLease: false }),
        );
        await create();
        fixture.detectChanges();

        expect(component["slotContention"]()).toBeNull();
        expect(text()).not.toContain("pamRequestSlotTaken");
      });
    });
  });

  describe("submitting a request", () => {
    it("sends only a duration on the automatic path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      requestsApi.submitAccessRequest.mockResolvedValue({
        approvalMode: "automatic",
        request: requestView(),
      } as never);
      await create();

      component["automaticForm"].patchValue({ durationSeconds: 1800, reason: "  " });
      await component["submit"]();

      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: 1800,
        start: undefined,
        end: undefined,
        // A blank reason is optional on this path and must not be sent as an empty string.
        reason: undefined,
      });
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "requestAccessModalApprovedSuccess",
      });
      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalledWith("cipher-1");
      expect(dialogRef.close).toHaveBeenCalledWith("submitted");
    });

    it("sends a window and reason on the human path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      requestsApi.submitAccessRequest.mockResolvedValue({
        approvalMode: "human",
        request: requestView(),
      } as never);
      await create();

      component["humanForm"].patchValue({
        date: futureDate,
        start: "09:00",
        end: "10:00",
        reason: " prod incident ",
      });
      await component["submit"]();

      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: undefined,
        start: new Date(`${futureDate}T09:00`).toISOString(),
        end: new Date(`${futureDate}T10:00`).toISOString(),
        reason: "prod incident",
      });
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "requestAccessModalRequestCreatedSuccess",
      });
      expect(dialogRef.close).toHaveBeenCalledWith("submitted");
    });

    it("sends a window that crosses midnight, ending on the following day", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      requestsApi.submitAccessRequest.mockResolvedValue({
        approvalMode: "human",
        request: requestView(),
      } as never);
      await create();

      component["humanForm"].patchValue({
        date: futureDate,
        start: "23:00",
        end: "01:00",
        reason: "overnight cutover",
      });
      await component["submit"]();

      const [year, month, day] = futureDate.split("-").map(Number);
      const endsAt = new Date(year, month - 1, day + 1, 1, 0, 0);
      expect(requestsApi.submitAccessRequest).toHaveBeenCalledWith("cipher-1", {
        durationSeconds: undefined,
        start: new Date(`${futureDate}T23:00`).toISOString(),
        end: endsAt.toISOString(),
        reason: "overnight cutover",
      });
    });

    it("re-checks the window on submit when it elapsed while the form sat open", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      const end = component["humanForm"].controls.end;
      component["humanForm"].patchValue({
        date: futureDate,
        start: "09:00",
        end: "10:00",
        reason: "prod incident",
      });
      expect(end.errors).toBeNull();

      // Ages the form past its window without touching a control; only submit re-validates.
      jest.useFakeTimers().setSystemTime(new Date(`${futureDate}T10:00`).getTime() + 1000);
      try {
        expect(end.errors).toBeNull();

        await component["submit"]();

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

      component["humanForm"].patchValue({
        date: futureDate,
        start: "10:00",
        end: "10:00",
        reason: "",
      });
      await component["submit"]();

      expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
    });

    it("refuses a reason that is only whitespace on the human path", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();

      component["humanForm"].patchValue({
        date: futureDate,
        start: "09:00",
        end: "10:00",
        reason: "   ",
      });
      await component["submit"]();

      expect(requestsApi.submitAccessRequest).not.toHaveBeenCalled();
    });

    it("shows the window error once the requester zeroes the window", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].patchValue({ date: futureDate, start: "10:00", end: "10:00" });
      component["humanForm"].controls.end.markAsTouched();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const error = endFieldError();
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain("requestAccessModalEndEqualsStart");
      const endInput = query("#pam-request-access-dialog_input_end");
      expect(endInput?.getAttribute("aria-invalid")).toBe("true");
    });

    it("reveals the window error when a start edit breaks a window the requester never touched", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].patchValue({ date: futureDate, start: "09:00", end: "10:00" });
      component["humanForm"].controls.start.setValue("10:00");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["humanForm"].controls.end.touched).toBe(true);
      expect(endFieldError()?.textContent).toContain("requestAccessModalEndEqualsStart");
    });

    it("clears the window error once the window is valid again", async () => {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "human" }));
      await create();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].patchValue({ date: futureDate, start: "10:00", end: "10:00" });
      component["humanForm"].controls.end.markAsTouched();
      fixture.detectChanges();
      await fixture.whenStable();

      component["humanForm"].controls.start.setValue("09:00");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["humanForm"].controls.end.errors).toBeNull();
      expect(endFieldError()).toBeNull();
    });

    it("names the governing cap in the window error, not the global ceiling", async () => {
      requestsApi.preCheck.mockResolvedValue(
        preCheck({ approvalMode: "human", maxDurationSeconds: 1800 }),
      );
      await create();

      component["humanForm"].patchValue({ date: futureDate, start: "09:00", end: "11:00" });

      expect(component["humanForm"].controls.end.errors?.[REQUEST_WINDOW_ERROR_KEY]).toEqual({
        problem: "exceedsMaxWindow",
        message: "requestAccessModalWindowExceedsMax 30 minutes",
      });
    });
  });

  describe("reconciling a rejected submit", () => {
    async function submitAndFail(message: string): Promise<void> {
      requestsApi.preCheck.mockResolvedValue(preCheck({ approvalMode: "automatic" }));
      const error = Object.assign(new Error(message), {
        name: "AccessRequestError",
        variant: "Api",
      });
      leasingErrors.isLeasingError.mockReturnValue(true);
      requestsApi.submitAccessRequest.mockRejectedValue(error);
      await create();
      await component["submit"]();
    }

    const windowExceedsMax = "The requested window exceeds the maximum of 604800 seconds.";

    /** The serialized `ErrorResponseModel` the SDK concatenates onto its transport string. */
    const wireBody = (serverMessage: string, exceptionMessage = serverMessage) =>
      `error in response: status code 400 Bad Request: {"object":"error",` +
      `"message":"${serverMessage}","validationErrors":null,` +
      `"exceptionMessage":"${exceptionMessage}","exceptionStackTrace":null}`;

    it.each([
      [REQUEST_ACCESS_SERVER_ERRORS.AlreadyPending, "requestAccessModalAlreadyPending"],
      [REQUEST_ACCESS_SERVER_ERRORS.AlreadyApproved, "requestAccessModalAlreadyApproved"],
      [REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive, "requestAccessModalAlreadyActive"],
    ])(
      "treats an 'already have this' refusal as information, closing as reconciled (%#)",
      async (serverMessage, toastKey) => {
        await submitAndFail(serverMessage);

        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "info",
          message: toastKey,
        });
        expect(dialogRef.close).toHaveBeenCalledWith("reconciled");
        expect(component["requestError"]()).toBeNull();
      },
    );

    it("announces the change so every surface re-reads into the existing state", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive);

      expect(accessRefresh.notifyAccessChanged).toHaveBeenCalledWith("cipher-1");
    });

    it("echoes a validation failure inline and keeps the dialog open", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd);

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("re-renders an over-long window in the requester's own language", async () => {
      await submitAndFail(windowExceedsMax);

      expect(component["requestError"]()).toBe("requestAccessModalWindowExceedsMax 7 days");
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("echoes an over-long duration, not worded as a window", async () => {
      const durationExceedsMax = "The requested duration exceeds the maximum of 1800 seconds.";
      await submitAndFail(durationExceedsMax);

      expect(component["requestError"]()).toBe(durationExceedsMax);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("echoes the SERVER's wording for an elapsed window", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.WindowInPast);

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SERVER_ERRORS.WindowInPast);
    });

    it("echoes the SDK's own wording for an elapsed window, refused before the wire", async () => {
      await submitAndFail(REQUEST_ACCESS_SDK_ERRORS.WindowInPast);

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SDK_ERRORS.WindowInPast);
    });

    it("surfaces the licensing refusal rather than generic copy", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.Unlicensed);

      expect(component["requestError"]()).toBe(REQUEST_ACCESS_SERVER_ERRORS.Unlicensed);
    });

    it("classifies on the server's message decoded out of the serialized response", async () => {
      await submitAndFail(wireBody(windowExceedsMax));

      expect(component["requestError"]()).toBe("requestAccessModalWindowExceedsMax 7 days");
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("ignores a catalog sentence carried elsewhere in the envelope", async () => {
      await submitAndFail(wireBody(windowExceedsMax, REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive));

      expect(component["requestError"]()).toBe("requestAccessModalWindowExceedsMax 7 days");
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("pins a missing reason to the reason control", async () => {
      await submitAndFail(REQUEST_ACCESS_SERVER_ERRORS.ReasonRequired);

      expect(component["humanForm"].controls.reason.errors).toEqual({ required: true });
    });

    it("falls back to generic copy for an unrecognised failure, leaking no raw payload", async () => {
      await submitAndFail("the server exploded at Bit.Services.Pam.Whatever");

      expect(component["requestError"]()).toBe("requestAccessModalGenericError");
    });
  });
});
