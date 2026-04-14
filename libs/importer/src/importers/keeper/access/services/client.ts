import {
  create,
  fromBinary,
  toBinary,
  type DescMessage,
  type MessageShape,
} from "@bufbuild/protobuf";

import { DeviceApprovalChannel, DnaMethod, DuoMethod, TwoFactorMethod } from "../enums";
import {
  ApiRequestSchema,
  type ApiRequestPayload,
  ApiRequestPayloadSchema,
  DeviceSchema,
  DeviceRegistrationRequestSchema,
  DeviceVerificationRequestSchema,
  EncryptedDataKeyType,
  LoginMethod,
  type LoginResponse,
  LoginResponseSchema,
  LoginState,
  RegisterDeviceInRegionRequestSchema,
  StartLoginRequestSchema,
  TwoFactorChannelType,
  TwoFactorExpiration,
  TwoFactorPushType,
  TwoFactorSendPushRequestSchema,
  TwoFactorValidateRequestSchema,
  TwoFactorValidateResponseSchema,
  TwoFactorValueType,
  ValidateAuthHashRequestSchema,
  ValidateDeviceVerificationCodeRequestSchema,
} from "../generated/api-request_pb";
import {
  SyncDownRequestSchema,
  type SyncDownResponse,
  SyncDownResponseSchema,
} from "../generated/sync-down_pb";
import {
  ClientOptions,
  DeviceCredentials,
  LoginResult,
  MessageType,
  PushMessage,
  SocketListener,
} from "../models";
import { Cancel, Resend, Ui } from "../ui";

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
import { post } from "./http";
import { encryptWithKeeperKey } from "./keys";
import { connectPushSocket } from "./socket";

export class Client {
  private server: string;
  private readonly clientVersion: string = "ts17.0.0";
  private readonly deviceName: string = "TypeScript Keeper SDK";
  private readonly ui: Ui;
  private serverKeyId: number = 7;
  private readonly locale: string = "en_US";

  constructor(options: ClientOptions) {
    this.server = options.region;
    this.ui = options.ui;
  }

  async login(username: string, password: string, options: ClientOptions): Promise<LoginResult> {
    if (options.publicKeyId) {
      this.serverKeyId = options.publicKeyId;
    }

    const { deviceToken, devicePrivateKey } =
      options.deviceToken && options.devicePrivateKey
        ? await this.loadDeviceCredentials(options.deviceToken, options.devicePrivateKey)
        : await this.registerDevice();

    const messageSessionUid = getRandomBytes(16);
    const transmissionKey = generateEncryptionKey();
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

  async syncDown(sessionToken: Uint8Array): Promise<SyncDownResponse[]> {
    const pages: SyncDownResponse[] = [];
    let token: Uint8Array = new Uint8Array();

    while (true) {
      const page = await this.syncDownRequest(sessionToken, token);
      pages.push(page);

      if (!page.hasMore) {
        break;
      }

      token = page.continuationToken;
    }

    return pages;
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

    const request = create(DeviceRegistrationRequestSchema, {
      deviceName: this.deviceName,
      clientVersion: this.clientVersion,
      devicePublicKey: publicKeyBytes,
    });

    const response = await this.apiRequest(
      "authentication/register_device",
      request,
      DeviceRegistrationRequestSchema,
    );
    const device = fromBinary(DeviceSchema, response);

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
    const publicKeyBytes = await this.getPublicKeyFromPrivate(devicePrivateKey);

    const request = create(RegisterDeviceInRegionRequestSchema, {
      encryptedDeviceToken: deviceToken,
      clientVersion: this.clientVersion,
      deviceName: this.deviceName,
      devicePublicKey: publicKeyBytes,
    });

    try {
      await this.apiRequest(
        "authentication/register_device_in_region",
        request,
        RegisterDeviceInRegionRequestSchema,
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
        DeviceApprovalChannel.TwoFactor,
      ]),
      "Device approval",
    );

    // TwoFactor: prompt for a code and validate with TWO_FA_CODE_NONE (server auto-detects type)
    if (method === DeviceApprovalChannel.TwoFactor) {
      const code = await this.getTwoFactorCodeFromUi(TwoFactorMethod.Totp);
      const updatedToken = await this.validate2FA(
        currentLoginToken,
        code,
        new Uint8Array(),
        TwoFactorValueType.TWO_FA_CODE_NONE,
      );
      return await this.resumeLogin(updatedToken, deviceToken, messageSessionUid);
    }

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
        // KeeperPush: race between code entry and push notification
        approvalResult = this.throwIfCancel(
          await Promise.race([
            this.ui.provideApprovalCode(method, "Approve the request on your Keeper device"),
            socket.waitForMessage(),
          ]),
          "Device approval",
        );
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
      throw new Error("Device approval failed or timed out");
    } else if (typeof result === "string" && result.length > 0) {
      await this.validateDeviceVerificationCode(username, result);
      return await this.resumeLogin(currentLoginToken, deviceToken, messageSessionUid);
    } else if (typeof result === "object" && "messageType" in result) {
      const { messageType, message } = result as PushMessage;
      if (
        messageType === MessageType.SESSION &&
        message.command === "device_verified" &&
        message.username === username
      ) {
        this.ui.closeApprovalDialog();
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
    const request = create(DeviceVerificationRequestSchema, {
      username,
      encryptedDeviceToken: deviceToken,
      verificationChannel: resend ? "email_resend" : "email",
      clientVersion: this.clientVersion,
      messageSessionUid,
    });

    await this.apiRequest(
      "authentication/request_device_verification",
      request,
      DeviceVerificationRequestSchema,
    );
  }

  private async validateDeviceVerificationCode(username: string, code: string): Promise<void> {
    const request = create(ValidateDeviceVerificationCodeRequestSchema, {
      username: username.toLowerCase(),
      clientVersion: this.clientVersion,
      verificationCode: code,
    });

    await this.apiRequest(
      "authentication/validate_device_verification_code",
      request,
      ValidateDeviceVerificationCodeRequestSchema,
    );
  }

  private async send2FAPush(
    encryptedLoginToken: Uint8Array,
    pushType?: TwoFactorPushType,
  ): Promise<void> {
    const request = create(TwoFactorSendPushRequestSchema, {
      encryptedLoginToken,
      pushType: pushType || TwoFactorPushType.TWO_FA_PUSH_NONE,
    });

    await this.apiRequest("authentication/2fa_send_push", request, TwoFactorSendPushRequestSchema);
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

  private supported2faMethods: Set<TwoFactorMethod> = new Set([
    TwoFactorMethod.Totp,
    TwoFactorMethod.Sms,
    TwoFactorMethod.Duo,
    TwoFactorMethod.KeeperDna,
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
      .filter((x) => x !== undefined && this.supported2faMethods.has(x));

    if (methods.length === 0) {
      await this.ui.showError("keeperUnsupported2faMethod");
      throw new Error("Two-factor authentication cancelled by user");
    }

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
      // Google Authenticator TOTP like codes
      case TwoFactorChannelType.TWO_FA_CT_TOTP: {
        // TODO: We only give one attempt for TOTP codes at the moment. Should we allow retries?
        const code = await this.getTwoFactorCodeFromUi(TwoFactorMethod.Totp);
        currentLoginToken = await this.validate2FA(
          currentLoginToken,
          code,
          channel.channelUid,
          TwoFactorValueType.TWO_FA_CODE_TOTP,
        );
        break;
      }

      // SMS codes
      case TwoFactorChannelType.TWO_FA_CT_SMS: {
        await this.send2FAPush(currentLoginToken, TwoFactorPushType.TWO_FA_PUSH_SMS);
        const code = await this.getTwoFactorCodeFromUi(TwoFactorMethod.Sms);
        currentLoginToken = await this.validate2FA(
          currentLoginToken,
          code,
          channel.channelUid,
          TwoFactorValueType.TWO_FA_CODE_SMS,
        );
        break;
      }

      // Keeper DNA: push or manual code entry from the Keeper app (e.g. Apple Watch)
      case TwoFactorChannelType.TWO_FA_CT_DNA: {
        const dnaMethod = this.throwIfCancel(
          await this.ui.selectDnaMethod([DnaMethod.Push, DnaMethod.Code]),
          "Two-factor authentication",
        );

        switch (dnaMethod) {
          // Push: server sends notification, device responds with a TOTP code via websocket
          case DnaMethod.Push: {
            await this.send2FAPush(currentLoginToken, TwoFactorPushType.TWO_FA_PUSH_DNA);

            const dnaResult = await Promise.race([
              socket.waitForMessage(),
              this.ui.waitForDnaPush(),
            ]);

            this.ui.closeDnaPushDialog();

            if (dnaResult && typeof dnaResult === "object" && "messageType" in dnaResult) {
              const { messageType: mt, message: msg } = dnaResult as PushMessage;
              const passcode = msg.passcode as string | undefined;

              if (mt === MessageType.DNA && passcode) {
                currentLoginToken = await this.validate2FA(
                  currentLoginToken,
                  passcode,
                  channel.channelUid,
                  TwoFactorValueType.TWO_FA_CODE_DNA,
                );
              } else {
                throw new Error("Keeper DNA authentication failed or timed out");
              }
            } else {
              throw new Error("Keeper DNA authentication cancelled");
            }
            break;
          }

          // Code: user reads the code from their device and enters it manually
          case DnaMethod.Code: {
            const code = await this.getTwoFactorCodeFromUi(TwoFactorMethod.KeeperDna);
            currentLoginToken = await this.validate2FA(
              currentLoginToken,
              code,
              channel.channelUid,
              TwoFactorValueType.TWO_FA_CODE_DNA,
            );
            break;
          }
          default:
            throw new Error("Unsupported Keeper DNA method selected");
        }

        break;
      }

      // Duo Security (can have multiple methods: push, sms, voice, passcode)
      case TwoFactorChannelType.TWO_FA_CT_DUO: {
        const duoMethods = channel.capabilities
          .map((cap: string) => this.duoCapabilityToMethod.get(cap))
          .filter((x: DuoMethod | undefined): x is DuoMethod => x !== undefined);

        const duoMethod = this.throwIfCancel(
          await this.ui.selectDuoMethod(duoMethods, channel.phoneNumber),
          "Two-factor authentication",
        );

        switch (duoMethod) {
          // Push first sends a notification to the user's device, then waits for them to approve it.
          // Voice is similar but initiates an automated phone call instead.
          case DuoMethod.Push:
          case DuoMethod.Voice: {
            // Trigger the action on the server to send the push or make the call
            await this.send2FAPush(currentLoginToken, this.duoMethodToPush.get(duoMethod)!);

            // Duo Push/Voice: race between a push notification or a possible cancellation by the user.
            const result = await Promise.race([
              socket.waitForMessage(),
              this.ui.waitForDuoPush(duoMethod),
            ]);

            this.ui.closeDuoPushDialog();

            if (result && typeof result === "object" && "messageType" in result) {
              const { messageType: mt, message: msg } = result as PushMessage;
              const event = msg.event as string | undefined;
              const encryptedLoginToken = msg.encryptedLoginToken as string | undefined;

              if (mt === MessageType.DNA && event === "received_totp" && encryptedLoginToken) {
                currentLoginToken = base64UrlDecode(encryptedLoginToken);
              } else {
                throw new Error("DUO authentication failed or timed out");
              }
            } else {
              throw new Error("DUO authentication cancelled");
            }
            break;
          }

          // Duo Passcode: user needs to enter a passcode generated by the Duo mobile app.
          // It's a one-shot operation, no request is sent to the server to trigger it.
          case DuoMethod.Passcode: {
            const code = await this.getTwoFactorCodeFromUi(TwoFactorMethod.Duo);
            // TODO: Handle cancellation
            currentLoginToken = await this.validate2FA(
              currentLoginToken,
              code,
              channel.channelUid,
              TwoFactorValueType.TWO_FA_CODE_DUO,
            );
            break;
          }

          // Duo SMS: this is like a combination of the Push and Passcode methods.
          // First a push notification is sent to the user to trigger an SMS with a code,
          // then the user needs to enter that code in the UI.
          case DuoMethod.Sms: {
            // Trigger the SMS to be sent to the user
            await this.send2FAPush(currentLoginToken, this.duoMethodToPush.get(duoMethod)!);
            const smsCode = await this.getTwoFactorCodeFromUi(TwoFactorMethod.Duo);
            // TODO: Handle cancellation
            currentLoginToken = await this.validate2FA(
              currentLoginToken,
              smsCode,
              channel.channelUid,
              TwoFactorValueType.TWO_FA_CODE_DUO,
            );
            break;
          }
          default:
            throw new Error("Unsupported two-factor method selected");
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
    valueType: TwoFactorValueType,
  ): Promise<Uint8Array> {
    const request = create(TwoFactorValidateRequestSchema, {
      encryptedLoginToken,
      value: code,
      valueType,
      channelUid,
      expireIn: TwoFactorExpiration.TWO_FA_EXP_IMMEDIATELY,
    });

    const responseBytes = await this.apiRequest(
      "authentication/2fa_validate",
      request,
      TwoFactorValidateRequestSchema,
    );

    const validateResponse = fromBinary(TwoFactorValidateResponseSchema, responseBytes);

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
    const request = create(StartLoginRequestSchema, {
      encryptedLoginToken,
      encryptedDeviceToken: deviceToken,
      loginMethod: LoginMethod.EXISTING_ACCOUNT,
      clientVersion: this.clientVersion,
      messageSessionUid,
    });

    const responseBytes = await this.apiRequest(
      "authentication/start_login",
      request,
      StartLoginRequestSchema,
    );
    return fromBinary(LoginResponseSchema, responseBytes);
  }

  private async startLogin(
    username: string,
    deviceToken: Uint8Array,
    messageSessionUid: Uint8Array,
  ): Promise<LoginResponse> {
    const request = create(StartLoginRequestSchema, {
      username,
      encryptedDeviceToken: deviceToken,
      loginMethod: LoginMethod.EXISTING_ACCOUNT,
      clientVersion: this.clientVersion,
      messageSessionUid,
    });

    const responseBytes = await this.apiRequest(
      "authentication/start_login",
      request,
      StartLoginRequestSchema,
    );
    return fromBinary(LoginResponseSchema, responseBytes);
  }

  private async validateAuthHash(
    authHash: Uint8Array,
    encryptedLoginToken: Uint8Array,
  ): Promise<LoginResponse> {
    const request = create(ValidateAuthHashRequestSchema, {
      authResponse: authHash,
      encryptedLoginToken,
    });

    const responseBytes = await this.apiRequest(
      "authentication/validate_auth_hash",
      request,
      ValidateAuthHashRequestSchema,
    );
    return fromBinary(LoginResponseSchema, responseBytes);
  }

  private async syncDownRequest(
    sessionToken: Uint8Array,
    continuationToken?: Uint8Array,
  ): Promise<SyncDownResponse> {
    const request = create(SyncDownRequestSchema, {
      dataVersion: 0,
      continuationToken: continuationToken || new Uint8Array(),
    });

    const responseBytes = await this.apiRequestAuth(
      "vault/sync_down",
      request,
      SyncDownRequestSchema,
      sessionToken,
    );
    return fromBinary(SyncDownResponseSchema, responseBytes);
  }

  private async apiRequest<D extends DescMessage>(
    endpoint: string,
    request: MessageShape<D>,
    requestSchema: D,
  ): Promise<Uint8Array> {
    const payload = create(ApiRequestPayloadSchema, {
      payload: toBinary(requestSchema, request),
    });

    return await this.executeRest(endpoint, payload);
  }

  private async apiRequestAuth<D extends DescMessage>(
    endpoint: string,
    request: MessageShape<D>,
    requestSchema: D,
    sessionToken: Uint8Array,
  ): Promise<Uint8Array> {
    const payload = create(ApiRequestPayloadSchema, {
      payload: toBinary(requestSchema, request),
      encryptedSessionToken: sessionToken,
    });

    return await this.executeRest(endpoint, payload);
  }

  private async executeRest(endpoint: string, payload: ApiRequestPayload): Promise<Uint8Array> {
    const url = endpoint.startsWith("https://")
      ? endpoint
      : `https://${this.server}/api/rest/${endpoint}`;

    let keyId = this.serverKeyId;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const transmissionKey = generateEncryptionKey();
        const payloadBytes = toBinary(ApiRequestPayloadSchema, payload);
        const encryptedPayload = await encryptAesV2(new Uint8Array(payloadBytes), transmissionKey);
        const encryptedKey = await encryptWithKeeperKey(transmissionKey, keyId);

        const apiRequest = create(ApiRequestSchema, {
          encryptedTransmissionKey: encryptedKey,
          publicKeyId: keyId,
          locale: this.locale,
          encryptedPayload: encryptedPayload,
        });

        const requestBytes = toBinary(ApiRequestSchema, apiRequest);
        const response = await post(url, requestBytes.buffer as ArrayBuffer);

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

        if (lastError.message.includes('"error":"key"')) {
          const match = lastError.message.match(/"key_id":(\d+)/);
          if (match) {
            const newKeyId = parseInt(match[1], 10);
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
