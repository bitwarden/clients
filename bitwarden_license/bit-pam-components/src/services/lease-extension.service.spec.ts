import { mock, MockProxy } from "jest-mock-extended";
import { NEVER, of } from "rxjs";

import {
  AccessLeaseSdkService,
  AccessRequestSdkService,
  DefaultAccessRefreshService,
} from "@bitwarden/bit-pam";
import type { AccessLeaseId, CipherAccessStateView } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { LeaseExtensionService } from "./lease-extension.service";

const CIPHER_ID = "cipher-1";
const LEASE_ID = "lease-1" as unknown as AccessLeaseId;

function state(overrides: Partial<CipherAccessStateView> = {}): CipherAccessStateView {
  return { cipherId: CIPHER_ID, ...overrides } as unknown as CipherAccessStateView;
}

describe("LeaseExtensionService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let logService: MockProxy<LogService>;
  let accessRefresh: DefaultAccessRefreshService;
  let service: LeaseExtensionService;
  let notified: string[];

  function answerDialogWith(result: unknown) {
    dialogService.open.mockReturnValue({ closed: of(result) } as unknown as DialogRef);
  }

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);
    accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    });
    notified = [];
    jest
      .spyOn(accessRefresh, "notifyAccessChanged")
      .mockImplementation((id?: string) => void notified.push(id ?? ""));
    service = new LeaseExtensionService(
      requestsApi,
      leasesApi,
      accessRefresh,
      dialogService,
      toastService,
      i18nService,
      logService,
    );
  });

  describe("maxExtensionSeconds", () => {
    it("returns the rule's cap when extensions are allowed", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        state({ extensionsAllowed: true, maxExtensionDurationSeconds: 3600 } as never),
      );

      expect(await service.maxExtensionSeconds(CIPHER_ID)).toBe(3600);
    });

    it("returns null when the rule allows no extension", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        state({ extensionsAllowed: false, maxExtensionDurationSeconds: 3600 } as never),
      );

      expect(await service.maxExtensionSeconds(CIPHER_ID)).toBeNull();
    });

    it("returns null, logging the failure, when the state cannot be read", async () => {
      const error = new Error("offline");
      requestsApi.getCipherAccessState.mockRejectedValue(error);

      expect(await service.maxExtensionSeconds(CIPHER_ID)).toBeNull();
      expect(logService.error).toHaveBeenCalledWith(error);
    });
  });

  describe("extend", () => {
    it("does nothing when the dialog is dismissed", async () => {
      answerDialogWith(undefined);

      await service.extend(CIPHER_ID, LEASE_ID, 3600);

      expect(leasesApi.extendLease).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(notified).toEqual([]);
    });

    it("extends with the chosen length and reason, toasts success and announces the change", async () => {
      const request = { durationSeconds: 1800, reason: "still working" };
      answerDialogWith(request);
      leasesApi.extendLease.mockResolvedValue({ status: "approved" } as never);

      await service.extend(CIPHER_ID, LEASE_ID, 3600);

      expect(leasesApi.extendLease).toHaveBeenCalledWith(LEASE_ID, request);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamExtendLeaseSuccess",
      });
      expect(notified).toEqual([CIPHER_ID]);
    });

    it("warns rather than reporting success when the extension is denied", async () => {
      answerDialogWith({ durationSeconds: 1800, reason: "r" });
      leasesApi.extendLease.mockResolvedValue({ status: "denied" } as never);

      await service.extend(CIPHER_ID, LEASE_ID, 3600);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "warning",
        message: "pamExtendLeaseEnded",
      });
    });

    it("toasts an error and still announces the change when the call fails", async () => {
      answerDialogWith({ durationSeconds: 1800, reason: "r" });
      const error = new Error("boom");
      leasesApi.extendLease.mockRejectedValue(error);

      await service.extend(CIPHER_ID, LEASE_ID, 3600);

      expect(logService.error).toHaveBeenCalledWith(error);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamExtendLeaseError",
      });
      expect(notified).toEqual([CIPHER_ID]);
    });
  });
});
