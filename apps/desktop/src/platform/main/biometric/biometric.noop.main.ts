import { OsBiometricService } from "./desktop.biometrics.service";

export default class NoopBiometricsService implements OsBiometricService {
  constructor() {}

  async init() {}

  async osSupportsBiometric(): Promise<boolean> {
    return false;
  }

  async osBiometricsNeedsSetup(): Promise<boolean> {
    return false;
  }

  async osBiometricsCanAutoSetup(): Promise<boolean> {
    return false;
  }

  async osBiometricsSetup(): Promise<void> {}

  async getBiometricKey(
    service: string,
    storageKey: string,
    clientKeyHalfB64: string,
  ): Promise<string | null> {
    return null;
  }

  async setBiometricKey(
    service: string,
    storageKey: string,
    value: string,
    clientKeyPartB64: string | undefined,
  ): Promise<void> {
    return;
  }

  async deleteBiometricKey(service: string, key: string): Promise<void> {}

  async authenticateBiometric(): Promise<boolean> {
    throw new Error("Not supported on this platform");
  }
}
