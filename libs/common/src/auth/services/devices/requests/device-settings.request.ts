/**
 * Partial update of per-device settings. Only properties that are set are changed on the server;
 * omitted properties are left as-is.
 */
export class DeviceSettingsRequest {
  useNewUi?: boolean;

  constructor(useNewUi?: boolean) {
    this.useNewUi = useNewUi;
  }
}
