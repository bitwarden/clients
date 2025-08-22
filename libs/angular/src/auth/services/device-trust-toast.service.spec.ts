import { mock, MockProxy } from "jest-mock-extended";
import { EMPTY, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { DeviceTrustToastService as DeviceTrustToastServiceAbstraction } from "./device-trust-toast.service.abstraction";
import { DeviceTrustToastService } from "./device-trust-toast.service.implementation";

describe("DeviceTrustToastService", () => {
  let authRequestService: MockProxy<AuthRequestServiceAbstraction>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;

  let sut: DeviceTrustToastServiceAbstraction;

  beforeEach(() => {
    authRequestService = mock<AuthRequestServiceAbstraction>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    i18nService = mock<I18nService>();
    toastService = mock<ToastService>();

    i18nService.t.mockImplementation((key: string) => key); // just return the key that was given
  });

  const initService = () => {
    return new DeviceTrustToastService(
      authRequestService,
      deviceTrustService,
      i18nService,
      toastService,
    );
  };

  const loginApprovalToastOptions = {
    variant: "success",
    title: "",
    message: "loginApproved",
  };

  const deviceTrustedToastOptions = {
    variant: "success",
    title: "",
    message: "deviceTrusted",
  };

  describe("setupListeners$", () => {
    describe("given adminLoginApproved$ emits and deviceTrusted$ emits", () => {
      beforeEach(() => {
        // Arrange
        authRequestService.adminLoginApproved$ = of(undefined);
        deviceTrustService.deviceTrusted$ = of(undefined);
        sut = initService();
      });

      it("should trigger a toast for login approval", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).toHaveBeenCalledWith(loginApprovalToastOptions); // Assert
            done();
          },
        });
      });

      it("should trigger a toast for device trust", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).toHaveBeenCalledWith(deviceTrustedToastOptions); // Assert
            done();
          },
        });
      });
    });

    describe("given adminLoginApproved$ emits and deviceTrusted$ does not emit", () => {
      beforeEach(() => {
        // Arrange
        authRequestService.adminLoginApproved$ = of(undefined);
        deviceTrustService.deviceTrusted$ = EMPTY;
        sut = initService();
      });

      it("should trigger a toast for login approval", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).toHaveBeenCalledWith(loginApprovalToastOptions); // Assert
            done();
          },
        });
      });

      it("should NOT trigger a toast for device trust", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).not.toHaveBeenCalledWith(deviceTrustedToastOptions); // Assert
            done();
          },
        });
      });
    });

    describe("given adminLoginApproved$ does not emit and deviceTrusted$ emits", () => {
      beforeEach(() => {
        // Arrange
        authRequestService.adminLoginApproved$ = EMPTY;
        deviceTrustService.deviceTrusted$ = of(undefined);
        sut = initService();
      });

      it("should NOT trigger a toast for login approval", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).not.toHaveBeenCalledWith(loginApprovalToastOptions); // Assert
            done();
          },
        });
      });

      it("should trigger a toast for device trust", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).toHaveBeenCalledWith(deviceTrustedToastOptions); // Assert
            done();
          },
        });
      });
    });

    describe("given adminLoginApproved$ does not emit and deviceTrusted$ does not emit", () => {
      beforeEach(() => {
        // Arrange
        authRequestService.adminLoginApproved$ = EMPTY;
        deviceTrustService.deviceTrusted$ = EMPTY;
        sut = initService();
      });

      it("should NOT trigger a toast for login approval", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).not.toHaveBeenCalledWith(loginApprovalToastOptions); // Assert
            done();
          },
        });
      });

      it("should NOT trigger a toast for device trust", (done) => {
        // Act
        sut.setupListeners$.subscribe({
          complete: () => {
            expect(toastService.showToast).not.toHaveBeenCalledWith(deviceTrustedToastOptions); // Assert
            done();
          },
        });
      });
    });
  });
});
