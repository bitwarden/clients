import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { BiometricStateService } from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import { MainBiometricsService } from "./main-biometrics.service";
import OsBiometricsServiceLinux from "./os-biometrics-linux.service";
import OsBiometricsServiceMac from "./os-biometrics-mac.service";
import OsBiometricsServiceWindows from "./os-biometrics-windows.service";
import { OsBiometricService } from "./os-biometrics.service";

jest.mock("@bitwarden/desktop-napi", () => {
  return {
    biometrics: jest.fn(),
    passwords: jest.fn(),
  };
});

describe("biometrics tests", function () {
  const i18nService = mock<I18nService>();
  const windowMain = mock<WindowMain>();
  const logService = mock<LogService>();
  const messagingService = mock<MessagingService>();
  const biometricStateService = mock<BiometricStateService>();

  it("Should call the platformspecific methods", async () => {
    const sut = new MainBiometricsService(
      i18nService,
      windowMain,
      logService,
      messagingService,
      process.platform,
      biometricStateService,
    );

    const mockService = mock<OsBiometricService>();
    (sut as any).osBiometricsService = mockService;

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    await sut.authenticateBiometric();
    expect(mockService.authenticateBiometric).toBeCalled();
  });

  describe("Should create a platform specific service", function () {
    it("Should create a biometrics service specific for Windows", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        "win32",
        biometricStateService,
      );

      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(OsBiometricsServiceWindows);
    });

    it("Should create a biometrics service specific for MacOs", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        "darwin",
        biometricStateService,
      );
      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(OsBiometricsServiceMac);
    });

    it("Should create a biometrics service specific for Linux", () => {
      const sut = new MainBiometricsService(
        i18nService,
        windowMain,
        logService,
        messagingService,
        "linux",
        biometricStateService,
      );

      const internalService = (sut as any).osBiometricsService;
      expect(internalService).not.toBeNull();
      expect(internalService).toBeInstanceOf(OsBiometricsServiceLinux);
    });
  });
});
