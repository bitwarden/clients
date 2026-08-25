import { mock, MockProxy } from "jest-mock-extended";
import { NEVER } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import type {
  AccessRequestId,
  AccessRequestView,
  CipherAccessStateView,
} from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { AccessRequestCancelService } from "./access-request-cancel.service";
import { DefaultAccessRefreshService } from "./default-access-refresh.service";

const CIPHER_ID = "cipher-1";
const REQUEST_ID = "request-1" as unknown as AccessRequestId;

function state(overrides: Partial<CipherAccessStateView> = {}): CipherAccessStateView {
  return {
    cipherId: CIPHER_ID,
    activeLease: undefined,
    pendingRequest: undefined,
    approvedRequest: undefined,
    ...overrides,
  } as unknown as CipherAccessStateView;
}

function loadedRequest(overrides: Partial<AccessRequestView> = {}): AccessRequestView {
  return {
    id: REQUEST_ID,
    cipherId: CIPHER_ID,
    status: "pending",
    ...overrides,
  } as unknown as AccessRequestView;
}

describe("AccessRequestCancelService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let accessRefresh: DefaultAccessRefreshService;
  let service: AccessRequestCancelService;

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();
    // No push in these tests: the flow is exercised through local mutations only.
    accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    });
    i18nService.t.mockImplementation((key) => key);
    service = new AccessRequestCancelService(
      requestsApi,
      accessRefresh,
      dialogService,
      toastService,
      i18nService,
      logService,
    );
  });

  it("cancels the pending request, toasts success, and announces the change", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(
      state({ pendingRequest: { id: REQUEST_ID } as never }),
    );
    const announced = jest.spyOn(accessRefresh, "notifyAccessChanged");

    await service.cancelOutstandingRequest(CIPHER_ID);

    expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith(REQUEST_ID);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "pamCancelRequestCanceledToast" }),
    );
    expect(announced).toHaveBeenCalledWith(CIPHER_ID);
  });

  it("cancels an approved-but-unactivated request too", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(
      state({ approvedRequest: { id: REQUEST_ID } as never }),
    );

    await service.cancelOutstandingRequest(CIPHER_ID);

    expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith(REQUEST_ID);
  });

  it("describes the pending case in the confirmation", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(
      state({ pendingRequest: { id: REQUEST_ID } as never }),
    );

    await service.cancelOutstandingRequest(CIPHER_ID);

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: { key: "pamCancelRequestTitle" },
        content: { key: "pamCancelRequestPendingConfirm" },
        cancelButtonText: { key: "pamKeepRequest" },
        type: "danger",
      }),
    );
  });

  it("describes the approved case in the confirmation", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(
      state({ approvedRequest: { id: REQUEST_ID } as never }),
    );

    await service.cancelOutstandingRequest(CIPHER_ID);

    expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({ content: { key: "pamCancelRequestApprovedConfirm" } }),
    );
  });

  it("withdraws nothing when the confirmation is dismissed", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(
      state({ pendingRequest: { id: REQUEST_ID } as never }),
    );
    dialogService.openSimpleDialog.mockResolvedValue(false);

    await service.cancelOutstandingRequest(CIPHER_ID);

    expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("does nothing when no request is outstanding anymore", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(state());

    await service.cancelOutstandingRequest(CIPHER_ID);

    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("toasts an error and still announces the change when the cancel fails", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(
      state({ pendingRequest: { id: REQUEST_ID } as never }),
    );
    requestsApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));
    const announced = jest.spyOn(accessRefresh, "notifyAccessChanged");

    await service.cancelOutstandingRequest(CIPHER_ID);

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "pendingStateCancelError" }),
    );
    expect(announced).toHaveBeenCalledWith(CIPHER_ID);
  });

  describe("cancelRequestById", () => {
    it("cancels the pending request, toasts success, and announces the change", async () => {
      requestsApi.getAccessRequest.mockResolvedValue(loadedRequest());
      const announced = jest.spyOn(accessRefresh, "notifyAccessChanged");

      await expect(service.cancelRequestById(REQUEST_ID)).resolves.toBe(true);

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith(REQUEST_ID);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "pamCancelRequestCanceledToast" }),
      );
      expect(announced).toHaveBeenCalledWith(CIPHER_ID);
    });

    it("asks the same question the cipher-scoped entry point asks", async () => {
      requestsApi.getAccessRequest.mockResolvedValue(loadedRequest());

      await service.cancelRequestById(REQUEST_ID);
      const pendingOptions = dialogService.openSimpleDialog.mock.calls[0][0];

      requestsApi.getCipherAccessState.mockResolvedValue(
        state({ pendingRequest: { id: REQUEST_ID } as never }),
      );
      await service.cancelOutstandingRequest(CIPHER_ID);

      expect(dialogService.openSimpleDialog.mock.calls[1][0]).toEqual(pendingOptions);
    });

    it("describes the approved case in the confirmation", async () => {
      requestsApi.getAccessRequest.mockResolvedValue(loadedRequest({ status: "approved" }));

      await service.cancelRequestById(REQUEST_ID);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "pamCancelRequestApprovedConfirm" } }),
      );
    });

    it("withdraws nothing when the confirmation is dismissed", async () => {
      requestsApi.getAccessRequest.mockResolvedValue(loadedRequest());
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await expect(service.cancelRequestById(REQUEST_ID)).resolves.toBe(false);

      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("leaves a request that is no longer outstanding alone", async () => {
      // Activated since the caller rendered it: the lease, not the request, governs access now.
      requestsApi.getAccessRequest.mockResolvedValue(
        loadedRequest({ status: "approved", producedLeaseId: "lease-1" as never }),
      );

      await expect(service.cancelRequestById(REQUEST_ID)).resolves.toBe(false);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
    });

    it("toasts an error and still announces the change when the cancel fails", async () => {
      requestsApi.getAccessRequest.mockResolvedValue(loadedRequest());
      requestsApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));
      const announced = jest.spyOn(accessRefresh, "notifyAccessChanged");

      await expect(service.cancelRequestById(REQUEST_ID)).resolves.toBe(false);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "pendingStateCancelError" }),
      );
      expect(announced).toHaveBeenCalledWith(CIPHER_ID);
    });

    it("never rejects when the request cannot even be re-read", async () => {
      requestsApi.getAccessRequest.mockRejectedValue(new Error("boom"));
      const announced = jest.spyOn(accessRefresh, "notifyAccessChanged");

      await expect(service.cancelRequestById(REQUEST_ID)).resolves.toBe(false);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "pendingStateCancelError" }),
      );
      // No cipher to scope the signal to, so every leasing surface re-reads.
      expect(announced).toHaveBeenCalledWith(undefined);
    });
  });
});
