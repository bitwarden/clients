import {
  base64UrlDecode,
  decryptAesV2,
  decryptEc,
  decryptEncryptionParams,
  deriveV1KeyHash,
  encryptAesV2,
  generateEcKey,
  generateEncryptionKey,
  getRandomBytes,
  loadEcPrivateKey,
  unloadEcPublicKey,
} from "./crypto";
import {
  ApiRequest,
  ApiRequestPayload,
  Device,
  DeviceRegistrationRequest,
  DeviceVerificationRequest,
  EncryptedDataKeyType,
  LoginMethod,
  LoginResponse,
  LoginState,
  RegisterDeviceInRegionRequest,
  StartLoginRequest,
  TwoFactorChannelType,
  TwoFactorExpiration,
  TwoFactorPushType,
  TwoFactorSendPushRequest,
  TwoFactorValidateRequest,
  TwoFactorValidateResponse,
  TwoFactorValueType,
  ValidateAuthHashRequest,
  ValidateDeviceVerificationCodeRequest,
} from "./generated/APIRequest";
import { AccountSummaryElements, AccountSummaryRequest } from "./generated/AccountSummary";
import { SyncDownRequest, SyncDownResponse } from "./generated/SyncDown";
import { post } from "./http";
import { encryptWithKeeperKey } from "./keys";
import { connectPushSocket, MessageType, PushMessage, SocketListener } from "./socket";
import { Cancel, DeviceApprovalChannel, DuoMethod, Resend, TwoFactorMethod, Ui } from "./ui";

export interface LoginResult {
  sessionToken: Uint8Array;
  dataKey: Uint8Array;
}

export interface ClientOptions {
  // TODO: Make all not optional
  server?: string;
  clientVersion?: string;
  deviceName?: string;
  ui?: Ui;

  // Cache for testing. Not needed in production use.
  deviceToken?: string; // Base64
  devicePrivateKey?: string; // Base64
  publicKeyId?: number;
}

interface DeviceCredentials {
  deviceToken: Uint8Array;
  devicePrivateKey: CryptoKey;
}

export class Client {
  private server: string;
  private readonly clientVersion: string;
  private readonly deviceName: string;
  private readonly ui: Ui;
  private serverKeyId: number = 7;
  private readonly locale: string = "en_US";

  constructor(options: ClientOptions = {}) {
    this.server = options.server || "keepersecurity.com";
    this.clientVersion = options.clientVersion || "ts17.0.0";
    this.deviceName = options.deviceName || "TypeScript Keeper SDK";
    this.ui = options.ui || ({} as Ui);
  }

  async login(username: string, password: string, options: ClientOptions): Promise<LoginResult> {
    if (options.publicKeyId) {
      this.serverKeyId = options.publicKeyId;
    }

    const { deviceToken, devicePrivateKey } =
      options.deviceToken && options.devicePrivateKey
        ? await this.loadDeviceCredentials(options.deviceToken, options.devicePrivateKey)
        : await this.registerDevice();

    const messageSessionUid = await getRandomBytes(16);
    const transmissionKey = await generateEncryptionKey();
    let socket: SocketListener | null = null;

    try {
      socket = await connectPushSocket(
        this.server,
        deviceToken,
        messageSessionUid,
        transmissionKey,
        this.serverKeyId,
        this.locale,
      );

      let response = await this.startLogin(username, deviceToken, messageSessionUid);
      console.log("Initial login response:", LoginState[response.loginState]);

      const maxIterations = 10;
      let iterations = 0;

      while (iterations++ < maxIterations) {
        switch (response.loginState) {
          case LoginState.REQUIRES_AUTH_HASH:
            response = await this.handleAuthHash(password, response);
            break;

          case LoginState.REGION_REDIRECT:
            if (!response.stateSpecificValue) {
              throw new Error("Region redirect without server URL");
            }
            this.server = response.stateSpecificValue;
            await this.registerDeviceInRegion(deviceToken, devicePrivateKey);
            response = await this.startLogin(username, deviceToken, messageSessionUid);
            break;

          case LoginState.DEVICE_APPROVAL_REQUIRED:
            response = await this.handleDeviceApproval(
              username,
              deviceToken,
              messageSessionUid,
              response,
              socket,
            );
            break;

          case LoginState.REQUIRES_2FA:
            response = await this.handle2FA(
              username,
              deviceToken,
              messageSessionUid,
              response,
              socket,
            );
            break;

          case LoginState.LOGGED_IN:
            return await this.extractLoginResult(response, password, devicePrivateKey);

          default:
            this.throwLoginError(response);
        }
      }

      throw new Error(`Login exceeded maximum iterations (${maxIterations})`);
    } finally {
      if (socket) {
        socket.disconnect();
      }
    }
  }

  async syncDown(sessionToken: Uint8Array): Promise<SyncDownResponse> {
    let merged: SyncDownResponse | null = null;
    let token: Uint8Array = new Uint8Array();

    while (true) {
      const page = await this.syncDownRequest(sessionToken, token);

      if (!merged) {
        merged = page;
      } else {
        merged.userFolders.push(...page.userFolders);
        merged.sharedFolders.push(...page.sharedFolders);
        merged.userFolderSharedFolders.push(...page.userFolderSharedFolders);
        merged.sharedFolderFolders.push(...page.sharedFolderFolders);
        merged.records.push(...page.records);
        merged.recordMetaData.push(...page.recordMetaData);
        merged.nonSharedData.push(...page.nonSharedData);
        merged.recordLinks.push(...page.recordLinks);
        merged.userFolderRecords.push(...page.userFolderRecords);
        merged.sharedFolderRecords.push(...page.sharedFolderRecords);
        merged.sharedFolderFolderRecords.push(...page.sharedFolderFolderRecords);
        merged.sharedFolderUsers.push(...page.sharedFolderUsers);
        merged.sharedFolderTeams.push(...page.sharedFolderTeams);
        merged.recordAddAuditData.push(...page.recordAddAuditData);
        merged.teams.push(...page.teams);
        merged.sharingChanges.push(...page.sharingChanges);
        merged.pendingTeamMembers.push(...page.pendingTeamMembers);
        merged.breachWatchRecords.push(...page.breachWatchRecords);
        merged.userAuths.push(...page.userAuths);
        merged.breachWatchSecurityData.push(...page.breachWatchSecurityData);
        merged.removedUserFolders.push(...page.removedUserFolders);
        merged.removedSharedFolders.push(...page.removedSharedFolders);
        merged.removedUserFolderSharedFolders.push(...page.removedUserFolderSharedFolders);
        merged.removedSharedFolderFolders.push(...page.removedSharedFolderFolders);
        merged.removedRecords.push(...page.removedRecords);
        merged.removedRecordLinks.push(...page.removedRecordLinks);
        merged.removedUserFolderRecords.push(...page.removedUserFolderRecords);
        merged.removedSharedFolderRecords.push(...page.removedSharedFolderRecords);
        merged.removedSharedFolderFolderRecords.push(...page.removedSharedFolderFolderRecords);
        merged.removedSharedFolderUsers.push(...page.removedSharedFolderUsers);
        merged.removedSharedFolderTeams.push(...page.removedSharedFolderTeams);
        merged.removedTeams.push(...page.removedTeams);
        merged.ksmAppShares.push(...page.ksmAppShares);
        merged.ksmAppClients.push(...page.ksmAppClients);
        merged.shareInvitations.push(...page.shareInvitations);
        merged.recordRotations.push(...page.recordRotations);
        merged.users.push(...page.users);
        merged.removedUsers.push(...page.removedUsers);
        merged.securityScoreData.push(...page.securityScoreData);
        merged.notificationSync.push(...page.notificationSync);

        // Update continuation token and flags from latest page
        merged.continuationToken = page.continuationToken;
        merged.hasMore = page.hasMore;
        merged.cacheStatus = page.cacheStatus;
      }

      if (!page.hasMore) {
        break;
      }

      token = page.continuationToken;
    }

    return merged!;
  }

  async loadAccountSummary(sessionToken: Uint8Array): Promise<AccountSummaryElements> {
    return await this.accountSummaryRequest(sessionToken);
  }

  private async loadDeviceCredentials(
    deviceTokenBase64: string,
    devicePrivateKeyBase64: string,
  ): Promise<DeviceCredentials> {
    const deviceToken = base64UrlDecode(deviceTokenBase64);
    const privateKeyBytes = base64UrlDecode(devicePrivateKeyBase64);
    const devicePrivateKey = await loadEcPrivateKey(privateKeyBytes);
    return { deviceToken, devicePrivateKey };
  }

  private async registerDevice(): Promise<DeviceCredentials> {
    const { privateKey, publicKey } = await generateEcKey();
    const publicKeyBytes = await unloadEcPublicKey(publicKey);

    const request = DeviceRegistrationRequest.create({
      deviceName: this.deviceName,
      clientVersion: this.clientVersion,
      devicePublicKey: publicKeyBytes,
    });

    const response = await this.apiRequest(
      "authentication/register_device",
      request,
      DeviceRegistrationRequest,
    );
    const device = Device.fromBinary(response);

    const deviceToken = new Uint8Array(device.encryptedDeviceToken);

    return {
      deviceToken,
      devicePrivateKey: privateKey,
    };
  }

  private async registerDeviceInRegion(
    deviceToken: Uint8Array,
    devicePrivateKey: CryptoKey,
  ): Promise<void> {
    // Extract public key from private key
    const publicKeyBytes = await this.getPublicKeyFromPrivate(devicePrivateKey);

    const request = RegisterDeviceInRegionRequest.create({
      encryptedDeviceToken: deviceToken,
      clientVersion: this.clientVersion,
      deviceName: this.deviceName,
      devicePublicKey: publicKeyBytes,
    });

    try {
      await this.apiRequest(
        "authentication/register_device_in_region",
        request,
        RegisterDeviceInRegionRequest,
      );
    } catch (error: unknown) {
      // Ignore "already exists" errors - device may already be registered
      if (!(error instanceof Error && error.message.includes("exists"))) {
        throw error;
      }
    }
  }

  private async getPublicKeyFromPrivate(privateKey: CryptoKey): Promise<Uint8Array> {
    // Export private key to JWK to extract public key components
    const jwk = await crypto.subtle.exportKey("jwk", privateKey);
    // Create public key JWK (remove private component 'd')
    const publicJwk: JsonWebKey = {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
    };
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      [],
    );
    return await unloadEcPublicKey(publicKey);
  }

  private async handleAuthHash(password: string, response: LoginResponse): Promise<LoginResponse> {
    if (!response.salt || response.salt.length === 0) {
      throw new Error("No salt received from server");
    }
    if (!response.encryptedLoginToken || response.encryptedLoginToken.length === 0) {
      throw new Error("No login token received from server");
    }

    const salt = new Uint8Array(response.salt[0].salt);
    const iterations = response.salt[0].iterations || 100000;

    const authHash = await deriveV1KeyHash(password, salt, iterations);
    return await this.validateAuthHash(authHash, response.encryptedLoginToken);
  }

  private async extractLoginResult(
    response: LoginResponse,
    password: string,
    devicePrivateKey: CryptoKey,
  ): Promise<LoginResult> {
    if (!response.encryptedSessionToken || response.encryptedSessionToken.length === 0) {
      throw new Error("No session token received from server");
    }
    if (!response.encryptedDataKey || response.encryptedDataKey.length === 0) {
      throw new Error("No data key received from server");
    }

    const sessionToken = new Uint8Array(response.encryptedSessionToken);

    let dataKey: Uint8Array;
    switch (response.encryptedDataKeyType) {
      case EncryptedDataKeyType.BY_DEVICE_PUBLIC_KEY:
        dataKey = await decryptEc(new Uint8Array(response.encryptedDataKey), devicePrivateKey);
        break;
      case EncryptedDataKeyType.BY_PASSWORD:
        dataKey = await decryptEncryptionParams(
          password,
          new Uint8Array(response.encryptedDataKey),
        );
        break;
      default:
        throw new Error(`Unsupported encrypted data key type: ${response.encryptedDataKeyType}`);
    }

    return {
      sessionToken,
      dataKey,
    };
  }

  private async handleDeviceApproval(
    username: string,
    deviceToken: Uint8Array,
    messageSessionUid: Uint8Array,
    response: LoginResponse,
    socket: SocketListener,
  ): Promise<LoginResponse> {
    const currentLoginToken = response.encryptedLoginToken;

    const method = this.throwIfCancel(
      await this.ui.selectApprovalMethod([
        DeviceApprovalChannel.Email,
        DeviceApprovalChannel.KeeperPush,
      ]),
      "Device approval",
    );

    switch (method) {
      case DeviceApprovalChannel.Email:
        await this.requestDeviceVerification(username, deviceToken, messageSessionUid);
        break;
      case DeviceApprovalChannel.KeeperPush:
        await this.send2FAPush(response.encryptedLoginToken, TwoFactorPushType.TWO_FA_PUSH_KEEPER);
        break;
      default:
        throw new Error("Unsupported device approval method selected");
    }

    let approvalResult: string | typeof Resend | PushMessage;

    switch (method) {
      case DeviceApprovalChannel.KeeperPush:
        // KeeperPush: just wait for push notification approval
        approvalResult = await socket.waitForMessage();
        break;
      case DeviceApprovalChannel.Email:
        // Email: race between code entry and push notification
        approvalResult = this.throwIfCancel(
          await Promise.race([
            this.ui.provideApprovalCode(method, "Check your email for the verification code"),
            socket.waitForMessage(),
          ]),
          "Device approval",
        );
        break;
      default:
        throw new Error("Unsupported device approval method");
    }

    const result = approvalResult;

    if (result === Resend) {
      if (method === DeviceApprovalChannel.Email) {
        await this.requestDeviceVerification(username, deviceToken, messageSessionUid, true);
      }
    } else if (typeof result === "string") {
      await this.validateDeviceVerificationCode(username, result);
    } else if ("messageType" in result) {
      const { messageType, message } = result as PushMessage;
      if (
        messageType === MessageType.SESSION &&
        message.command === "device_verified" &&
        message.username === username
      ) {
        this.ui.closeApprovalDialog?.();
        return await this.resumeLogin(currentLoginToken, deviceToken, messageSessionUid);
      }
    }

    throw new Error("Device approval failed or timed out");
  }

  private async requestDeviceVerification(
    username: string,
    deviceToken: Uint8Array,
    messageSessionUid: Uint8Array,
    resend: boolean = false,
  ): Promise<void> {
    const request = DeviceVerificationRequest.create({
      username,
      encryptedDeviceToken: deviceToken,
      verificationChannel: resend ? "email_resend" : "email",
      clientVersion: this.clientVersion,
      messageSessionUid,
    });

    await this.apiRequest(
      "authentication/request_device_verification",
      request,
      DeviceVerificationRequest,
    );
  }

  private async validateDeviceVerificationCode(username: string, code: string): Promise<void> {
    const request = ValidateDeviceVerificationCodeRequest.create({
      username: username.toLowerCase(),
      clientVersion: this.clientVersion,
      verificationCode: code,
    });

    await this.apiRequest(
      "authentication/validate_device_verification_code",
      request,
      ValidateDeviceVerificationCodeRequest,
    );
  }

  private async send2FAPush(
    encryptedLoginToken: Uint8Array,
    pushType?: TwoFactorPushType,
  ): Promise<void> {
    const request = TwoFactorSendPushRequest.create({
      encryptedLoginToken,
      pushType: pushType || TwoFactorPushType.TWO_FA_PUSH_NONE,
    });

    await this.apiRequest("authentication/2fa_send_push", request, TwoFactorSendPushRequest);
  }

  private twoFactorMethodToUi = new Map<TwoFactorChannelType, TwoFactorMethod>([
    [TwoFactorChannelType.TWO_FA_CT_TOTP, TwoFactorMethod.Totp],
    [TwoFactorChannelType.TWO_FA_CT_SMS, TwoFactorMethod.Sms],
    [TwoFactorChannelType.TWO_FA_CT_DUO, TwoFactorMethod.Duo],
    [TwoFactorChannelType.TWO_FA_CT_RSA, TwoFactorMethod.Rsa],
    [TwoFactorChannelType.TWO_FA_CT_BACKUP, TwoFactorMethod.Backup],
    [TwoFactorChannelType.TWO_FA_CT_U2F, TwoFactorMethod.U2f],
    [TwoFactorChannelType.TWO_FA_CT_WEBAUTHN, TwoFactorMethod.WebAuthn],
    [TwoFactorChannelType.TWO_FA_CT_KEEPER, TwoFactorMethod.KeeperPush],
    [TwoFactorChannelType.TWO_FA_CT_DNA, TwoFactorMethod.KeeperDna],
  ]);

  private twoFactorMethodFromUi = new Map<TwoFactorMethod, TwoFactorChannelType>([
    [TwoFactorMethod.Totp, TwoFactorChannelType.TWO_FA_CT_TOTP],
    [TwoFactorMethod.Sms, TwoFactorChannelType.TWO_FA_CT_SMS],
    [TwoFactorMethod.Duo, TwoFactorChannelType.TWO_FA_CT_DUO],
    [TwoFactorMethod.Rsa, TwoFactorChannelType.TWO_FA_CT_RSA],
    [TwoFactorMethod.Backup, TwoFactorChannelType.TWO_FA_CT_BACKUP],
    [TwoFactorMethod.U2f, TwoFactorChannelType.TWO_FA_CT_U2F],
    [TwoFactorMethod.WebAuthn, TwoFactorChannelType.TWO_FA_CT_WEBAUTHN],
    [TwoFactorMethod.KeeperPush, TwoFactorChannelType.TWO_FA_CT_KEEPER],
    [TwoFactorMethod.KeeperDna, TwoFactorChannelType.TWO_FA_CT_DNA],
  ]);

  private duoCapabilityToMethod = new Map<string, DuoMethod>([
    ["push", DuoMethod.Push],
    ["sms", DuoMethod.Sms],
    ["phone", DuoMethod.Voice],
    ["mobile_otp", DuoMethod.Passcode],
  ]);

  private duoMethodToPush = new Map<DuoMethod, TwoFactorPushType>([
    [DuoMethod.Push, TwoFactorPushType.TWO_FA_PUSH_DUO_PUSH],
    [DuoMethod.Sms, TwoFactorPushType.TWO_FA_PUSH_DUO_TEXT],
    [DuoMethod.Voice, TwoFactorPushType.TWO_FA_PUSH_DUO_CALL],
  ]);

  private async handle2FA(
    _username: string,
    deviceToken: Uint8Array,
    messageSessionUid: Uint8Array,
    response: LoginResponse,
    socket: SocketListener,
  ): Promise<LoginResponse> {
    let currentLoginToken = response.encryptedLoginToken;

    const methods = response.channels
      .map((x) => this.twoFactorMethodToUi.get(x.channelType)!)
      .filter((x) => x !== undefined);

    const methodOrCancel = await this.ui.selectTwoFactorMethod(methods);
    if (methodOrCancel === Cancel) {
      throw new Error("Two-factor authentication cancelled by user");
    }

    const method = this.twoFactorMethodFromUi.get(methodOrCancel);
    const channel = response.channels.find((ch) => ch.channelType === method);
    if (!channel) {
      throw new Error("Selected two-factor method not available");
    }

    switch (method) {
      case TwoFactorChannelType.TWO_FA_CT_TOTP: {
        // TODO: We only give one attempt for TOTP codes at the moment. Should we allow retries?
        const code = await this.getTwoFactorCodeFromUi(TwoFactorMethod.Totp);
        currentLoginToken = await this.validate2FA(currentLoginToken, code, channel.channelUid);
        break;
      }

      case TwoFactorChannelType.TWO_FA_CT_DUO: {
        const duoMethods = channel.capabilities
          .map((cap) => this.duoCapabilityToMethod.get(cap))
          .filter((x) => x !== undefined);

        const duoMethod = this.throwIfCancel(
          await this.ui.selectDuoMethod(duoMethods, channel.phoneNumber),
          "Two-factor authentication",
        );

        switch (duoMethod) {
          case DuoMethod.Push:
          case DuoMethod.Sms:
          case DuoMethod.Voice:
            await this.send2FAPush(currentLoginToken, this.duoMethodToPush.get(duoMethod)!);
            break;
          case DuoMethod.Passcode: {
            const code = await this.getTwoFactorCodeFromUi(TwoFactorMethod.Duo);
            currentLoginToken = await this.validate2FA(currentLoginToken, code, channel.channelUid);
            break;
          }
          default:
            throw new Error("Unsupported two-factor method selected");
        }

        const { messageType, message } = await socket.waitForMessage();
        const event = message.event as string | undefined;
        const encryptedLoginToken = message.encryptedLoginToken as string | undefined;

        if (messageType === MessageType.DNA && event === "received_totp" && encryptedLoginToken) {
          currentLoginToken = base64UrlDecode(encryptedLoginToken);
        } else {
          throw new Error("DUO authentication failed or timed out");
        }

        break;
      }
      default:
        throw new Error("Unsupported two-factor method selected");
    }

    return await this.resumeLogin(currentLoginToken, deviceToken, messageSessionUid);
  }

  private async getTwoFactorCodeFromUi(method: TwoFactorMethod): Promise<string> {
    const codeOrResend = this.throwIfCancel(
      await this.ui.provideTwoFactorCode(method),
      "Two-factor authentication",
    );

    if (codeOrResend === Resend) {
      throw new Error("Resend not supported for TOTP");
    }

    return codeOrResend;
  }

  private throwIfCancel<T>(anyOrCancel: T | typeof Cancel, what: string): T {
    if (anyOrCancel === Cancel) {
      throw new Error(`${what} cancelled by user`);
    }
    return anyOrCancel;
  }

  private async validate2FA(
    encryptedLoginToken: Uint8Array,
    code: string,
    channelUid: Uint8Array,
  ): Promise<Uint8Array> {
    const request = TwoFactorValidateRequest.create({
      encryptedLoginToken,
      value: code,
      valueType: TwoFactorValueType.TWO_FA_CODE_TOTP,
      channelUid,
      expireIn: TwoFactorExpiration.TWO_FA_EXP_IMMEDIATELY,
    });

    const responseBytes = await this.apiRequest(
      "authentication/2fa_validate",
      request,
      TwoFactorValidateRequest,
    );

    const validateResponse = TwoFactorValidateResponse.fromBinary(responseBytes);

    if (
      !validateResponse.encryptedLoginToken ||
      validateResponse.encryptedLoginToken.length === 0
    ) {
      throw new Error("2FA validation failed: no encrypted login token returned");
    }

    return new Uint8Array(validateResponse.encryptedLoginToken);
  }

  private async resumeLogin(
    encryptedLoginToken: Uint8Array,
    deviceToken: Uint8Array,
    messageSessionUid: Uint8Array,
  ): Promise<LoginResponse> {
    const request = StartLoginRequest.create({
      encryptedLoginToken,
      encryptedDeviceToken: deviceToken,
      loginMethod: LoginMethod.EXISTING_ACCOUNT,
      clientVersion: this.clientVersion,
      messageSessionUid,
    });

    const responseBytes = await this.apiRequest(
      "authentication/start_login",
      request,
      StartLoginRequest,
    );
    return LoginResponse.fromBinary(responseBytes);
  }

  private async startLogin(
    username: string,
    deviceToken: Uint8Array,
    messageSessionUid: Uint8Array,
  ): Promise<LoginResponse> {
    const request = StartLoginRequest.create({
      username,
      encryptedDeviceToken: deviceToken,
      loginMethod: LoginMethod.EXISTING_ACCOUNT,
      clientVersion: this.clientVersion,
      messageSessionUid,
    });

    const responseBytes = await this.apiRequest(
      "authentication/start_login",
      request,
      StartLoginRequest,
    );
    return LoginResponse.fromBinary(responseBytes);
  }

  private async validateAuthHash(
    authHash: Uint8Array,
    encryptedLoginToken: Uint8Array,
  ): Promise<LoginResponse> {
    const request = ValidateAuthHashRequest.create({
      authResponse: authHash,
      encryptedLoginToken,
    });

    const responseBytes = await this.apiRequest(
      "authentication/validate_auth_hash",
      request,
      ValidateAuthHashRequest,
    );
    return LoginResponse.fromBinary(responseBytes);
  }

  private async syncDownRequest(
    sessionToken: Uint8Array,
    continuationToken?: Uint8Array,
  ): Promise<SyncDownResponse> {
    const request = SyncDownRequest.create({
      dataVersion: 0,
      continuationToken: continuationToken || new Uint8Array(),
    });

    const responseBytes = await this.apiRequestAuth(
      "vault/sync_down",
      request,
      SyncDownRequest,
      sessionToken,
    );
    return SyncDownResponse.fromBinary(responseBytes);
  }

  private async accountSummaryRequest(sessionToken: Uint8Array): Promise<AccountSummaryElements> {
    const request = AccountSummaryRequest.create({
      summaryVersion: 1,
    });

    const responseBytes = await this.apiRequestAuth(
      "login/account_summary",
      request,
      AccountSummaryRequest,
      sessionToken,
    );
    return AccountSummaryElements.fromBinary(responseBytes);
  }

  private async apiRequest<TReq>(
    endpoint: string,
    request: TReq,
    requestType: { toBinary: (req: TReq) => Uint8Array },
  ): Promise<Uint8Array> {
    const payload = ApiRequestPayload.create({
      payload: requestType.toBinary(request),
    });

    return await this.executeRest(endpoint, payload);
  }

  private async apiRequestAuth<TReq>(
    endpoint: string,
    request: TReq,
    requestType: { toBinary: (req: TReq) => Uint8Array },
    sessionToken: Uint8Array,
  ): Promise<Uint8Array> {
    const payload = ApiRequestPayload.create({
      payload: requestType.toBinary(request),
      encryptedSessionToken: sessionToken,
    });

    return await this.executeRest(endpoint, payload);
  }

  private async executeRest(endpoint: string, payload: ApiRequestPayload): Promise<Uint8Array> {
    const url = endpoint.startsWith("https://")
      ? endpoint
      : `https://${this.server}/api/rest/${endpoint}`;

    console.log(`[Keeper API] >>> ${endpoint} -> ${url}`);

    let keyId = this.serverKeyId;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const transmissionKey = await generateEncryptionKey();
        const payloadBytes = ApiRequestPayload.toBinary(payload);
        const encryptedPayload = await encryptAesV2(new Uint8Array(payloadBytes), transmissionKey);
        const encryptedKey = await encryptWithKeeperKey(transmissionKey, keyId);

        const apiRequest = ApiRequest.create({
          encryptedTransmissionKey: encryptedKey,
          publicKeyId: keyId,
          locale: this.locale,
          encryptedPayload: encryptedPayload,
        });

        const requestBytes = ApiRequest.toBinary(apiRequest);
        const response = await post(url, new Uint8Array(requestBytes));

        console.log(`[Keeper API] <<< ${endpoint} OK (${response.data?.length || 0} bytes)`);

        if (keyId !== this.serverKeyId) {
          this.serverKeyId = keyId;
        }

        if (response.data && response.data.length > 0) {
          const decryptedResponse = await decryptAesV2(response.data, transmissionKey);
          return decryptedResponse;
        }

        return new Uint8Array();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.log(`[Keeper API] <<< ${endpoint} ERROR: ${lastError.message}`);

        if (lastError.message.includes('"error":"key"')) {
          const match = lastError.message.match(/"key_id":(\d+)/);
          if (match) {
            const newKeyId = parseInt(match[1], 10);
            console.log(`[Keeper API] Retrying with key ID ${newKeyId}`);
            keyId = newKeyId;
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError || new Error("Failed to execute REST request");
  }

  private throwLoginError(response: LoginResponse): never {
    const state = LoginState[response.loginState] || response.loginState;
    const message = response.message || "Unknown error";

    switch (response.loginState) {
      case LoginState.DEVICE_LOCKED:
      case LoginState.DEVICE_ACCOUNT_LOCKED:
        throw new Error(`Device locked: ${message}`);

      case LoginState.ACCOUNT_LOCKED:
        throw new Error(`Account locked: ${message}`);

      case LoginState.LICENSE_EXPIRED:
        throw new Error(`License expired: ${message}`);

      case LoginState.UPGRADE:
        throw new Error(`Account upgrade required: ${message}`);

      case LoginState.REDIRECT_CLOUD_SSO:
      case LoginState.REDIRECT_ONSITE_SSO:
        throw new Error(`SSO authentication not supported: ${message}`);

      default:
        throw new Error(`Unhandled login state: ${state} - ${message}`);
    }
  }
}
