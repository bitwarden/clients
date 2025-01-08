export class DeviceVerificationRequest {
  unknownDeviceVerificationEnabled: boolean;

  constructor(unknownDeviceVerificationEnabled: boolean, deviceVerificationOtp?: string) {
    this.unknownDeviceVerificationEnabled = unknownDeviceVerificationEnabled;
  }
}
