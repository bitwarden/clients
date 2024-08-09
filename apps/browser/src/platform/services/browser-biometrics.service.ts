import { Injectable } from "@angular/core";

import { BiometricsService } from "@bitwarden/common/platform/biometrics/biometric.service";

import { BrowserApi } from "../browser/browser-api";

@Injectable()
export abstract class BrowserBiometricsService extends BiometricsService {
  async supportsBiometric() {
    const platformInfo = await BrowserApi.getPlatformInfo();
    if (platformInfo.os === "mac" || platformInfo.os === "win" || platformInfo.os === "linux") {
      return true;
    }
    return false;
  }

  abstract authenticateBiometric(): Promise<boolean>;
  abstract isBiometricUnlockAvailable(): Promise<boolean>;
}
