import { Injectable } from "@angular/core";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";

import { BrowserBiometricsService } from "./browser-biometrics.service";

@Injectable()
export class BackgroundBrowserBiometricsService extends BrowserBiometricsService {
  constructor(private nativeMessagingBackground: NativeMessagingBackground) {
    super();
  }

  async authenticateBiometric(): Promise<boolean> {
    const responsePromise = this.nativeMessagingBackground.getResponse();
    await this.nativeMessagingBackground.send({ command: "biometricUnlock" });
    const response = await responsePromise;
    return response.response === "unlocked";
  }

  async isBiometricUnlockAvailable(): Promise<boolean> {
    const responsePromise = this.nativeMessagingBackground.getResponse();
    await this.nativeMessagingBackground.send({ command: "biometricUnlockAvailable" });
    const response = await responsePromise;
    return response.response === "available";
  }

  async biometricsNeedsSetup(): Promise<boolean> {
    return false;
  }

  async biometricsSupportsAutoSetup(): Promise<boolean> {
    return false;
  }

  async biometricsSetup(): Promise<void> {}
}
