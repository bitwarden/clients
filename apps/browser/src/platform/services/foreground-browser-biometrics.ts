import { BrowserApi } from "../browser/browser-api";

import { BrowserBiometricsService } from "./browser-biometrics.service";

export class ForegroundBrowserBiometricsService extends BrowserBiometricsService {
  async authenticateBiometric(): Promise<boolean> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: boolean;
      error: string;
    }>("biometricUnlock");
    if (!response.result) {
      throw response.error;
    }
    return response.result;
  }

  async isBiometricUnlockAvailable(): Promise<boolean> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: boolean;
      error: string;
    }>("biometricUnlockAvailable");
    return response.result && response.result === true;
  }

  async biometricsNeedsSetup(): Promise<boolean> {
    return false;
  }

  async biometricsSupportsAutoSetup(): Promise<boolean> {
    return false;
  }

  async biometricsSetup(): Promise<void> {}
}
