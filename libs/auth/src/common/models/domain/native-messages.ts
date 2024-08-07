export const NativeMessageCommandTypes = {
  WRONG_USER: "wrongUserId",
  VERIFY_FINGERPRINT: "verifyFingerprint",
  SETUP_ENCRYPTION: "setupEncryption",
  INVALIDATE_ENCRYPTION: "invalidateEncryption",
  BIOMETRIC_UNLOCK: "biometricUnlock",
  BROWSER_PROVIDED_USER_KEY: "browserProvidedUserKey",
} as const;
type NativeMessagingCommandTypeKeys =
  (typeof NativeMessageCommandTypes)[keyof typeof NativeMessageCommandTypes];

export const BiometricUnlockResponses = {
  NO_USER: "no user",
  NO_USER_ID: "no userId",
  NOT_SUPPORTED: "not supported",
  NO_CLIENT_KEY_HALF: "no client key half",
  NOT_ENABLED: "not enabled",
  CANCELED: "canceled",
  UNLOCKED: "unlocked",
} as const;
type BiometricUnlockResponseTypeKeys =
  (typeof BiometricUnlockResponses)[keyof typeof BiometricUnlockResponses];

export class LegacyUnencryptedCommandMessage {
  constructor(
    public command: NativeMessagingCommandTypeKeys,
    public appId: string,
  ) {}
}

export class LegacySetupEncryptionResponse extends LegacyUnencryptedCommandMessage {
  constructor(
    appId: string,
    public sharedSecret: string,
  ) {
    super(NativeMessageCommandTypes.SETUP_ENCRYPTION, appId);
  }
}

export class LegacyInnerCommandMessage {
  command: NativeMessagingCommandTypeKeys;

  userId?: string;
  timestamp?: number;

  constructor(command: NativeMessagingCommandTypeKeys) {
    this.command = command;
  }
}

export class BrowserCommandLegacyMessage extends LegacyInnerCommandMessage {
  constructor(
    command: NativeMessagingCommandTypeKeys,
    public appId: string,
  ) {
    super(command);
  }
}

export class BiometricUnlockCommand extends LegacyInnerCommandMessage {
  constructor() {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK);
  }
}

export class BiometricProvideUserKeyCommand extends LegacyInnerCommandMessage {
  constructor(public userKeyB64: string) {
    super(NativeMessageCommandTypes.BROWSER_PROVIDED_USER_KEY);
  }
}

export class BiometricNativeCommandResponse extends LegacyInnerCommandMessage {
  constructor(
    public command: NativeMessagingCommandTypeKeys,
    public response: BiometricUnlockResponseTypeKeys,
  ) {
    super(command);
  }
}

export class BiometricCommandWrongUser extends LegacyUnencryptedCommandMessage {
  constructor(appId: string) {
    super(NativeMessageCommandTypes.WRONG_USER, appId);
  }
}

export class BiometricCommandVerifyFingerprint extends LegacyUnencryptedCommandMessage {
  constructor(appId: string) {
    super(NativeMessageCommandTypes.VERIFY_FINGERPRINT, appId);
  }
}

export class BiometricCommandSetupEncryption extends LegacyInnerCommandMessage {
  constructor(
    public publicKey: string,
    public userId: string,
  ) {
    super(NativeMessageCommandTypes.SETUP_ENCRYPTION);
  }
}

export class BiometricCommandInvalidateEncryption extends LegacyUnencryptedCommandMessage {
  constructor(appId: string) {
    super(NativeMessageCommandTypes.INVALIDATE_ENCRYPTION, appId);
  }
}

export class BiometricCommandProvideUserKey extends LegacyInnerCommandMessage {
  constructor(public userKeyB64: string) {
    super(NativeMessageCommandTypes.BROWSER_PROVIDED_USER_KEY);
  }
}

export class BiometricUnlockNotSupportedResponse extends BiometricNativeCommandResponse {
  constructor() {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK, BiometricUnlockResponses.NOT_SUPPORTED);
  }
}

export class BiometricUnlockCanceledResponse extends BiometricNativeCommandResponse {
  constructor() {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK, BiometricUnlockResponses.CANCELED);
  }
}

export class BiometricUnlockUnlockedResponse extends BiometricNativeCommandResponse {
  constructor(public userKeyB64: string) {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK, BiometricUnlockResponses.UNLOCKED);
  }
}

export class BiometricUnlockNoUserResponse extends BiometricNativeCommandResponse {
  constructor() {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK, BiometricUnlockResponses.NO_USER);
  }
}

export class BiometricUnlockNoUserIdResponse extends BiometricNativeCommandResponse {
  constructor() {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK, BiometricUnlockResponses.NO_USER_ID);
  }
}

export class BiometricUnlockNoClientKeyHalfResponse extends BiometricNativeCommandResponse {
  constructor() {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK, BiometricUnlockResponses.NO_CLIENT_KEY_HALF);
  }
}

export class BiometricUnlockNotEnabledResponse extends BiometricNativeCommandResponse {
  constructor() {
    super(NativeMessageCommandTypes.BIOMETRIC_UNLOCK, BiometricUnlockResponses.NOT_ENABLED);
  }
}
