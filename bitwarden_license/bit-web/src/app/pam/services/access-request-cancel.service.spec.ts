import { mock, MockProxy } from "jest-mock-extended";
import { NEVER } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import type { AccessRequestId, CipherAccessStateView } from "../abstractions/access-lease";
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

describe("AccessRequestCancelService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let accessRefresh: DefaultAccessRefreshService;
  let service: AccessRequestCancelService;

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
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
      expect.objectContaining({ variant: "success", message: "pendingStateCancelSuccess" }),
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

  it("does nothing when no request is outstanding anymore", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(state());

    await service.cancelOutstandingRequest(CIPHER_ID);

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
});
