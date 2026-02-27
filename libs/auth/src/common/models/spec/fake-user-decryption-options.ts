import {
  KeyConnectorUserDecryptionOption,
  TrustedDeviceUserDecryptionOption,
  UserDecryptionOptions,
} from "../domain";

// To discourage creating new user decryption options, we don't expose a constructor.
// These helpers are for testing purposes only.

/** Testing helper for creating new instances of `UserDecryptionOptions` */
export class FakeUserDecryptionOptions extends UserDecryptionOptions {
  constructor(init: Partial<UserDecryptionOptions>) {
    super();
    Object.assign(this, init);
  }
}

/** Testing helper for creating new instances of `KeyConnectorUserDecryptionOption` */
export class FakeKeyConnectorUserDecryptionOption extends KeyConnectorUserDecryptionOption {
  constructor(keyConnectorUrl: string) {
    super();
    this.keyConnectorUrl = keyConnectorUrl;
  }
}

/** Testing helper for creating new instances of `TrustedDeviceUserDecryptionOption` */
export class FakeTrustedDeviceUserDecryptionOption extends TrustedDeviceUserDecryptionOption {
  constructor(
    hasAdminApproval: boolean,
    hasLoginApprovingDevice: boolean,
    hasManageResetPasswordPermission: boolean,
    isTdeOffboarding: boolean,
  ) {
    super();
    this.hasAdminApproval = hasAdminApproval;
    this.hasLoginApprovingDevice = hasLoginApprovingDevice;
    this.hasManageResetPasswordPermission = hasManageResetPasswordPermission;
    this.isTdeOffboarding = isTdeOffboarding;
  }
}
