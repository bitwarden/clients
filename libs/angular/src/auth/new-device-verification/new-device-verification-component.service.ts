export abstract class NewDeviceVerificationComponentService {
  /**
   * States whether component should show a back button. Can be overridden by client-specific component services.
   * - Default = `true`
   * - Extension = `false` (because Extension shows a back button in the header instead)
   */
  abstract showBackButton: () => boolean;
}
