import {
  create,
  fromBinary,
  toBinary,
  type DescMessage,
  type MessageShape,
} from "@bufbuild/protobuf";

import { DeviceApprovalChannel, DuoMethod, TwoFactorMethod } from "../enums";
import { KeeperAuthError, KeeperAuthErrorCode } from "../errors";
import {
  ApiRequestSchema,
  type ApiRequestPayload,
  ApiRequestPayloadSchema,
  DeviceSchema,
  DeviceRegistrationRequestSchema,
  DeviceStatus,
  DeviceVerificationRequestSchema,
  DeviceVerificationResponseSchema,
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
  type SsoCloudResponse,
  SsoCloudRequestSchema,
  SsoCloudResponseSchema,
} from "../generated/ssocloud_pb";
import {
  SyncDownRequestSchema,
  type SyncDownResponse,
  SyncDownResponseSchema,
} from "../generated/sync-down_pb";
import {
  ChannelUid,
  ClientOptions,
  ContinuationToken,
  DeviceCredentials,
  DeviceToken,
  KeeperKey,
  KeeperSalt,
  LoginResult,
  LoginToken,
  MessageSessionUid,
  MessageType,
  PushMessage,
  SessionToken,
  SocketListener,
} from "../models";
import { Cancel, Resend, TryAnother, Ui } from "../ui";

import {
  base64UrlDecode,
  base64UrlEncode,
  decryptAesV2,
  decryptEc,
  decryptEncryptionParams,
  deriveV1KeyHash,
  encryptAesV2,
  generateEcKey,
  generateEncryptionKey,
  getRandomBytes,
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
  private password: string | null = null;
  private ssoTransmissionKey: KeeperKey | null = null;

  constructor(options: ClientOptions) {
    this.server = options.region;
    this.ui = options.ui;
  }

  async login(username: string): Promise<LoginResult> {
    const { deviceToken, devicePrivateKey } = await this.registerDevice();

    const messageSessionUid = getRandomBytes(16) as MessageSessionUid;
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
            response = await this.handleAuthHash(response);
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
              [
                DeviceApprovalChannel.Email,
                DeviceApprovalChannel.KeeperPush,
                DeviceApprovalChannel.TwoFactor,
              ],
            );
            break;

          case LoginState.REQUIRES_DEVICE_ENCRYPTED_DATA_KEY:
            response = await this.handleDeviceApproval(
              username,
              deviceToken,
              messageSessionUid,
              response,
              socket,
              [DeviceApprovalChannel.KeeperPush, DeviceApprovalChannel.AdminApproval],
            );
            break;

          case LoginState.REDIRECT_CLOUD_SSO:
            response = await this.handleCloudSso(response, deviceToken, messageSessionUid);
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
            return await this.extractLoginResult(response, devicePrivateKey);

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

  async syncDown(sessionToken: SessionToken): Promise<SyncDownResponse[]> {
    const pages: SyncDownResponse[] = [];
    let token = new Uint8Array() as ContinuationToken;

    while (true) {
      const page = await this.syncDownRequest(sessionToken, token);
      pages.push(page);

      if (!page.hasMore) {
        break;
      }

      token = page.continuationToken as ContinuationToken;
    }

    return pages;
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

    const deviceToken = new Uint8Array(device.encryptedDeviceToken) as DeviceToken;

    return {
      deviceToken,
      devicePrivateKey: privateKey,
    };
  }

  private async registerDeviceInRegion(
    deviceToken: DeviceToken,
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

  private async handleAuthHash(response: LoginResponse): Promise<LoginResponse> {
    if (!response.salt || response.salt.length === 0) {
      throw new Error("No salt received from server");
    }

    if (!response.encryptedLoginToken || response.encryptedLoginToken.length === 0) {
      throw new Error("No login token received from server");
    }

    const salt = new Uint8Array(response.salt[0].salt) as KeeperSalt;
    const iterations = response.salt[0].iterations || 100000;

    let previousPasswordRejected = false;
    while (true) {
      const passwordOrCancel = await this.ui.promptForPassword({ previousPasswordRejected });
      if (passwordOrCancel === Cancel) {
        throw new KeeperAuthError(
          KeeperAuthErrorCode.Cancelled,
          "Authentication cancelled by user",
        );
      }

      this.password = passwordOrCancel;

      const authHash = await deriveV1KeyHash(this.password, salt, iterations);
      try {
        return await this.validateAuthHash(authHash, response.encryptedLoginToken as LoginToken);
      } catch {
        previousPasswordRejected = true;
      }
    }
  }

  private async handleCloudSso(
    response: LoginResponse,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
  ): Promise<LoginResponse> {
    if (!response.url) {
      throw new Error("Cloud SSO redirect without URL");
    }

    const ssoUrl = await this.buildCloudSsoUrl(response.url, messageSessionUid);
    const tokenOrCancel = await this.ui.ssoLogin(ssoUrl);
    if (tokenOrCancel === Cancel) {
      throw new KeeperAuthError(
        KeeperAuthErrorCode.Cancelled,
        "SSO authentication cancelled by user",
      );
    }

    const ssoResponse = await this.decryptCloudSsoResponse(tokenOrCancel);
    if (ssoResponse.encryptedLoginToken.length === 0) {
      throw new Error("SSO response missing login token");
    }

    return await this.resumeLoginAfterSso(
      ssoResponse.encryptedLoginToken as LoginToken,
      deviceToken,
      messageSessionUid,
    );
  }

  private async buildCloudSsoUrl(
    ssoBaseUrl: string,
    messageSessionUid: MessageSessionUid,
  ): Promise<string> {
    const ssoRequest = create(SsoCloudRequestSchema, {
      messageSessionUid,
      clientVersion: this.clientVersion,
      detached: true,
      dest: "vault",
    });

    const ssoRequestBytes = toBinary(SsoCloudRequestSchema, ssoRequest);

    const payload = create(ApiRequestPayloadSchema, {
      payload: ssoRequestBytes,
    });

    this.ssoTransmissionKey = generateEncryptionKey();

    const payloadBytes = toBinary(ApiRequestPayloadSchema, payload);
    const encryptedPayload = await encryptAesV2(
      new Uint8Array(payloadBytes),
      this.ssoTransmissionKey,
    );
    const encryptedKey = await encryptWithKeeperKey(this.ssoTransmissionKey, this.serverKeyId);

    const apiRequest = create(ApiRequestSchema, {
      encryptedTransmissionKey: encryptedKey,
      publicKeyId: this.serverKeyId,
      locale: this.locale,
      encryptedPayload,
    });

    const apiRequestBytes = toBinary(ApiRequestSchema, apiRequest);
    const encodedPayload = base64UrlEncode(new Uint8Array(apiRequestBytes));

    return ssoBaseUrl + "?payload=" + encodedPayload;
  }

  private async decryptCloudSsoResponse(token: string): Promise<SsoCloudResponse> {
    if (!this.ssoTransmissionKey) {
      throw new Error("SSO transmission key not available");
    }

    const encryptedBytes = base64UrlDecode(token);
    const decryptedBytes = await decryptAesV2(encryptedBytes, this.ssoTransmissionKey);
    return fromBinary(SsoCloudResponseSchema, decryptedBytes);
  }

  private async resumeLoginAfterSso(
    encryptedLoginToken: LoginToken,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
  ): Promise<LoginResponse> {
    const request = create(StartLoginRequestSchema, {
      encryptedLoginToken,
      encryptedDeviceToken: deviceToken,
      loginMethod: LoginMethod.AFTER_SSO,
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

  private async extractLoginResult(
    response: LoginResponse,
    devicePrivateKey: CryptoKey,
  ): Promise<LoginResult> {
    if (!response.encryptedSessionToken || response.encryptedSessionToken.length === 0) {
      throw new Error("No session token received from server");
    }

    if (!response.encryptedDataKey || response.encryptedDataKey.length === 0) {
      throw new Error("No data key received from server");
    }

    const sessionToken = new Uint8Array(response.encryptedSessionToken) as SessionToken;

    let dataKey: KeeperKey;
    switch (response.encryptedDataKeyType) {
      case EncryptedDataKeyType.BY_DEVICE_PUBLIC_KEY:
        dataKey = (await decryptEc(
          new Uint8Array(response.encryptedDataKey),
          devicePrivateKey,
        )) as KeeperKey;
        break;
      case EncryptedDataKeyType.BY_PASSWORD:
        if (!this.password) {
          throw new Error("Password required but not available");
        }
        dataKey = await decryptEncryptionParams(
          this.password,
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
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
    response: LoginResponse,
    socket: SocketListener,
    channels: DeviceApprovalChannel[],
  ): Promise<LoginResponse> {
    const currentLoginToken = response.encryptedLoginToken as LoginToken;

    // Register a single socket listener for the whole approval flow. If the user
    // picks "Try another method" and we loop back, we reuse this same promise so
    // the push message isn't consumed by an abandoned listener from a prior iteration.
    let socketMessagePromise: Promise<PushMessage> | undefined;

    while (true) {
      const method = this.throwIfCancel(
        await this.ui.selectApprovalMethod(channels),
        "Device approval",
      );

      // TwoFactor: prompt for a code and validate with TWO_FA_CODE_NONE (server auto-detects type).
      // Also listen on the socket: if the user approves on a Keeper DNA device (e.g. Apple Watch),
      // the server pushes the resulting login token via websocket and we never see a typed code.
      if (method === DeviceApprovalChannel.TwoFactor) {
        // Keeper hides which 2FA method the user has configured. Sending a push
        // with TWO_FA_PUSH_NONE lets the server dispatch the right one (SMS gets
        // delivered, TOTP/security key etc. are no-ops). Same call also wires the
        // Resend button.
        const triggerPush = () => this.send2FAPush(currentLoginToken);
        await triggerPush();

        let previousCodeRejected = false;
        let tryAnother = false;
        let updatedToken: LoginToken | undefined;
        while (updatedToken === undefined) {
          socketMessagePromise ??= socket.waitForMessage();
          const result = await Promise.race([
            this.getTwoFactorCodeFromUi(TwoFactorMethod.Totp, {
              onResend: triggerPush,
              hidden: true,
              previousCodeRejected,
            }),
            socketMessagePromise,
          ]);
          previousCodeRejected = false;

          if (result === TryAnother) {
            tryAnother = true;
            break;
          }

          if (typeof result === "object" && "messageType" in result) {
            // Socket fired first: device approval came through via push.
            socketMessagePromise = undefined;
            const { messageType: mt, message: msg } = result as PushMessage;
            const passcode = msg.passcode as string | undefined;
            const event = msg.event as string | undefined;
            const encryptedLoginToken = msg.encryptedLoginToken as string | undefined;

            if (mt === MessageType.DNA && event === "received_totp" && encryptedLoginToken) {
              // Server already validated the code from the watch; reuse the new token.
              updatedToken = base64UrlDecode(encryptedLoginToken) as LoginToken;
            } else if (mt === MessageType.DNA && passcode) {
              updatedToken = await this.validate2FA(
                currentLoginToken,
                passcode,
                new Uint8Array() as ChannelUid,
                TwoFactorValueType.TWO_FA_CODE_NONE,
              );
            } else {
              throw new KeeperAuthError(
                KeeperAuthErrorCode.MfaFailed,
                "Device approval failed or timed out",
              );
            }
          } else {
            try {
              updatedToken = await this.validate2FA(
                currentLoginToken,
                result,
                new Uint8Array() as ChannelUid,
                TwoFactorValueType.TWO_FA_CODE_NONE,
              );
            } catch {
              // Re-prompt with an inline error instead of aborting the import.
              previousCodeRejected = true;
            }
          }
        }

        if (tryAnother) {
          continue;
        }
        if (updatedToken === undefined) {
          throw new KeeperAuthError(
            KeeperAuthErrorCode.MfaFailed,
            "Device approval failed unexpectedly",
          );
        }
        return await this.resumeLogin(updatedToken, deviceToken, messageSessionUid);
      }

      switch (method) {
        case DeviceApprovalChannel.Email:
          await this.requestDeviceVerification(username, deviceToken, messageSessionUid);
          break;
        case DeviceApprovalChannel.KeeperPush:
          await this.send2FAPush(
            response.encryptedLoginToken as LoginToken,
            TwoFactorPushType.TWO_FA_PUSH_KEEPER,
          );
          break;
        case DeviceApprovalChannel.AdminApproval:
          await this.requestDeviceAdminApproval(username, deviceToken, messageSessionUid);
          break;
        default:
          throw new Error("Unsupported device approval method selected");
      }

      if (socketMessagePromise === undefined) {
        socketMessagePromise = socket.waitForMessage();
      }

      let restartOuter = false;
      let previousCodeRejected = false;
      while (true) {
        const approvalResult = this.throwIfCancel(
          await Promise.race([
            this.ui.provideApprovalCode(method, { previousCodeRejected }),
            socketMessagePromise,
          ]),
          "Device approval",
        );
        previousCodeRejected = false;

        if (approvalResult === TryAnother) {
          restartOuter = true;
          break;
        }

        if (approvalResult === Resend) {
          if (method === DeviceApprovalChannel.Email) {
            await this.requestDeviceVerification(username, deviceToken, messageSessionUid, true);
            continue;
          }
          throw new Error("Resend not supported for this approval method");
        }

        if (typeof approvalResult === "string" && approvalResult.length > 0) {
          try {
            await this.validateDeviceVerificationCode(username, approvalResult);
          } catch {
            // Server rejected the code (typically a wrong/expired email code).
            // Re-prompt with an inline error instead of aborting the import.
            previousCodeRejected = true;
            continue;
          }
          return await this.resumeOrRestartLogin(
            currentLoginToken,
            username,
            deviceToken,
            messageSessionUid,
          );
        }

        if (typeof approvalResult === "object" && "messageType" in approvalResult) {
          const { messageType, message } = approvalResult as PushMessage;
          if (messageType === MessageType.SESSION && message.username === username) {
            const approvedByAdmin =
              message.message === "device_approved" && message.approved === true;
            if (message.command === "device_verified" || approvedByAdmin) {
              return await this.resumeOrRestartLogin(
                currentLoginToken,
                username,
                deviceToken,
                messageSessionUid,
              );
            }
          }
        }

        break;
      }

      if (restartOuter) {
        continue;
      }

      throw new KeeperAuthError(
        KeeperAuthErrorCode.MfaFailed,
        "Device approval failed or timed out",
      );
    }
  }

  private async requestDeviceVerification(
    username: string,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
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

  private async requestDeviceAdminApproval(
    username: string,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
  ): Promise<void> {
    const request = create(DeviceVerificationRequestSchema, {
      username,
      encryptedDeviceToken: deviceToken,
      clientVersion: this.clientVersion,
      messageSessionUid,
    });

    const responseBytes = await this.apiRequest(
      "authentication/request_device_admin_approval",
      request,
      DeviceVerificationRequestSchema,
    );

    if (responseBytes.length > 0) {
      const response = fromBinary(DeviceVerificationResponseSchema, responseBytes);
      if (response.deviceStatus !== DeviceStatus.DEVICE_OK) {
        throw new Error("Admin approval request rejected by server");
      }
    }
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
    encryptedLoginToken: LoginToken,
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
    TwoFactorMethod.KeeperDna,

    // TODO: Duo is actually working but it's disabled for the initial release to allow for more testing.
    //TwoFactorMethod.Duo,
  ]);

  private async handle2FA(
    _username: string,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
    response: LoginResponse,
    socket: SocketListener,
  ): Promise<LoginResponse> {
    let currentLoginToken = response.encryptedLoginToken as LoginToken;

    const methods = response.channels
      .map((x) => this.twoFactorMethodToUi.get(x.channelType)!)
      .filter((x) => x !== undefined && this.supported2faMethods.has(x));

    if (methods.length === 0) {
      await this.ui.showError("keeperUnsupported2faMethod");
      throw new KeeperAuthError(
        KeeperAuthErrorCode.UnsupportedTwoFactorMethod,
        "No supported two-factor methods available",
      );
    }

    twoFactor: while (true) {
      const methodOrCancel = await this.ui.selectTwoFactorMethod(methods);
      if (methodOrCancel === Cancel) {
        throw new KeeperAuthError(
          KeeperAuthErrorCode.Cancelled,
          "Two-factor authentication cancelled by user",
        );
      }

      const method = this.twoFactorMethodFromUi.get(methodOrCancel);
      const channel = response.channels.find((ch) => ch.channelType === method);
      if (!channel) {
        throw new KeeperAuthError(
          KeeperAuthErrorCode.UnsupportedTwoFactorMethod,
          "Selected two-factor method not available",
        );
      }

      switch (method) {
        // Google Authenticator TOTP like codes
        case TwoFactorChannelType.TWO_FA_CT_TOTP: {
          const updated = await this.submitTwoFactorCodeWithRetry(TwoFactorMethod.Totp, (code) =>
            this.validate2FA(
              currentLoginToken,
              code,
              channel.channelUid as ChannelUid,
              TwoFactorValueType.TWO_FA_CODE_TOTP,
            ),
          );
          if (updated === TryAnother) {
            continue twoFactor;
          }
          currentLoginToken = updated;
          break;
        }

        // SMS codes
        case TwoFactorChannelType.TWO_FA_CT_SMS: {
          const sendSms = () =>
            this.send2FAPush(currentLoginToken, TwoFactorPushType.TWO_FA_PUSH_SMS);
          await sendSms();
          const updated = await this.submitTwoFactorCodeWithRetry(
            TwoFactorMethod.Sms,
            (code) =>
              this.validate2FA(
                currentLoginToken,
                code,
                channel.channelUid as ChannelUid,
                TwoFactorValueType.TWO_FA_CODE_SMS,
              ),
            sendSms,
          );
          if (updated === TryAnother) {
            continue twoFactor;
          }
          currentLoginToken = updated;
          break;
        }

        // Keeper DNA: server sends a push to the Keeper app (e.g. Apple Watch),
        // device responds with a TOTP code via websocket. No code-entry fallback —
        // the user just approves on their device.
        case TwoFactorChannelType.TWO_FA_CT_DNA: {
          await this.send2FAPush(currentLoginToken, TwoFactorPushType.TWO_FA_PUSH_DNA);

          const dnaResult = await Promise.race([socket.waitForMessage(), this.ui.waitForDnaPush()]);

          if (dnaResult === TryAnother) {
            continue twoFactor;
          }

          if (dnaResult && typeof dnaResult === "object" && "messageType" in dnaResult) {
            const { messageType: mt, message: msg } = dnaResult as PushMessage;
            const passcode = msg.passcode as string | undefined;

            if (mt === MessageType.DNA && passcode) {
              currentLoginToken = await this.validate2FA(
                currentLoginToken,
                passcode,
                channel.channelUid as ChannelUid,
                TwoFactorValueType.TWO_FA_CODE_DNA,
              );
            } else {
              throw new KeeperAuthError(
                KeeperAuthErrorCode.MfaFailed,
                "Keeper DNA authentication failed or timed out",
              );
            }
          } else {
            throw new KeeperAuthError(
              KeeperAuthErrorCode.Cancelled,
              "Keeper DNA authentication cancelled",
            );
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

              if (result === TryAnother) {
                continue twoFactor;
              }

              if (result && typeof result === "object" && "messageType" in result) {
                const { messageType: mt, message: msg } = result as PushMessage;
                const event = msg.event as string | undefined;
                const encryptedLoginToken = msg.encryptedLoginToken as string | undefined;

                if (mt === MessageType.DNA && event === "received_totp" && encryptedLoginToken) {
                  currentLoginToken = base64UrlDecode(encryptedLoginToken) as LoginToken;
                } else {
                  throw new KeeperAuthError(
                    KeeperAuthErrorCode.MfaFailed,
                    "DUO authentication failed or timed out",
                  );
                }
              } else {
                throw new KeeperAuthError(
                  KeeperAuthErrorCode.Cancelled,
                  "DUO authentication cancelled",
                );
              }
              break;
            }

            // Duo Passcode: user needs to enter a passcode generated by the Duo mobile app.
            // It's a one-shot operation, no request is sent to the server to trigger it.
            case DuoMethod.Passcode: {
              const updated = await this.submitTwoFactorCodeWithRetry(TwoFactorMethod.Duo, (code) =>
                this.validate2FA(
                  currentLoginToken,
                  code,
                  channel.channelUid as ChannelUid,
                  TwoFactorValueType.TWO_FA_CODE_DUO,
                ),
              );
              if (updated === TryAnother) {
                continue twoFactor;
              }
              currentLoginToken = updated;
              break;
            }

            // Duo SMS: this is like a combination of the Push and Passcode methods.
            // First a push notification is sent to the user to trigger an SMS with a code,
            // then the user needs to enter that code in the UI.
            case DuoMethod.Sms: {
              const sendSms = () =>
                this.send2FAPush(currentLoginToken, this.duoMethodToPush.get(duoMethod)!);
              await sendSms();
              const updated = await this.submitTwoFactorCodeWithRetry(
                TwoFactorMethod.Duo,
                (code) =>
                  this.validate2FA(
                    currentLoginToken,
                    code,
                    channel.channelUid as ChannelUid,
                    TwoFactorValueType.TWO_FA_CODE_DUO,
                  ),
                sendSms,
              );
              if (updated === TryAnother) {
                continue twoFactor;
              }
              currentLoginToken = updated;
              break;
            }
            default:
              throw new KeeperAuthError(
                KeeperAuthErrorCode.UnsupportedTwoFactorMethod,
                "Unsupported two-factor method selected",
              );
          }

          break;
        }
        default:
          throw new KeeperAuthError(
            KeeperAuthErrorCode.UnsupportedTwoFactorMethod,
            "Unsupported two-factor method selected",
          );
      }

      return await this.resumeLogin(currentLoginToken, deviceToken, messageSessionUid);
    }
  }

  private async getTwoFactorCodeFromUi(
    method: TwoFactorMethod,
    options: {
      onResend?: () => Promise<void>;
      hidden?: boolean;
      previousCodeRejected?: boolean;
    } = {},
  ): Promise<string | typeof TryAnother> {
    let previousCodeRejected = options.previousCodeRejected ?? false;
    for (;;) {
      const result = this.throwIfCancel(
        await this.ui.provideTwoFactorCode(method, {
          hidden: options.hidden ?? false,
          canResend: !!options.onResend,
          previousCodeRejected,
        }),
        "Two-factor authentication",
      );

      if (result !== Resend) {
        return result;
      }

      // Methods without a resend mechanism (TOTP, RSA, backup codes, Keeper DNA code)
      // silently re-prompt; SMS-style methods re-trigger the underlying push.
      if (options.onResend) {
        await options.onResend();
      }
      previousCodeRejected = false;
    }
  }

  /**
   * Prompts the user for a 2FA code, validates it, and retries with an inline
   * error if the server rejects the code. Returns the updated login token or
   * TryAnother if the user picked another method.
   */
  private async submitTwoFactorCodeWithRetry(
    method: TwoFactorMethod,
    validate: (code: string) => Promise<LoginToken>,
    onResend?: () => Promise<void>,
  ): Promise<LoginToken | typeof TryAnother> {
    let previousCodeRejected = false;
    while (true) {
      const code = await this.getTwoFactorCodeFromUi(method, {
        onResend,
        previousCodeRejected,
      });
      if (code === TryAnother) {
        return TryAnother;
      }
      try {
        return await validate(code);
      } catch {
        previousCodeRejected = true;
      }
    }
  }

  private throwIfCancel<T>(anyOrCancel: T | typeof Cancel, what: string): T {
    if (anyOrCancel === Cancel) {
      throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, `${what} cancelled by user`);
    }
    return anyOrCancel;
  }

  private async validate2FA(
    encryptedLoginToken: LoginToken,
    code: string,
    channelUid: ChannelUid,
    valueType: TwoFactorValueType,
  ): Promise<LoginToken> {
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

    return new Uint8Array(validateResponse.encryptedLoginToken) as LoginToken;
  }

  private async resumeLogin(
    encryptedLoginToken: LoginToken,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
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

  /**
   * Resumes login with the existing login token, falling back to a fresh login
   * if the token has expired. The login token has a server-side lifetime of a
   * few minutes, so a user who approves the device after a long delay would
   * otherwise hit "login_token_expired". The device is already approved at this
   * point, so a fresh start_login proceeds straight past device approval.
   */
  private async resumeOrRestartLogin(
    encryptedLoginToken: LoginToken,
    username: string,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
  ): Promise<LoginResponse> {
    try {
      return await this.resumeLogin(encryptedLoginToken, deviceToken, messageSessionUid);
    } catch (error) {
      if (error instanceof Error && error.message.includes("login_token_expired")) {
        return await this.startLogin(username, deviceToken, messageSessionUid);
      }
      throw error;
    }
  }

  private async startLogin(
    username: string,
    deviceToken: DeviceToken,
    messageSessionUid: MessageSessionUid,
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
    encryptedLoginToken: LoginToken,
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
    sessionToken: SessionToken,
    continuationToken?: ContinuationToken,
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
    sessionToken: SessionToken,
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

      case LoginState.REDIRECT_ONSITE_SSO:
        throw new Error(`SSO authentication not supported: ${message}`);

      default:
        throw new Error(`Unhandled login state: ${state} - ${message}`);
    }
  }
}
