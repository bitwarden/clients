// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { DecryptedCommandData } from "../models/native-messaging/decrypted-command-data";
import { CredentialCreatePayload } from "../models/native-messaging/encrypted-message-payloads/credential-create-payload";
import { CredentialRetrievePayload } from "../models/native-messaging/encrypted-message-payloads/credential-retrieve-payload";
import { CredentialUpdatePayload } from "../models/native-messaging/encrypted-message-payloads/credential-update-payload";
import { PasswordGeneratePayload } from "../models/native-messaging/encrypted-message-payloads/password-generate-payload";
import { AccountStatusResponse } from "../models/native-messaging/encrypted-message-responses/account-status-response";
import { CipherResponse } from "../models/native-messaging/encrypted-message-responses/cipher-response";
import { FailureStatusResponse } from "../models/native-messaging/encrypted-message-responses/failure-status-response";
import { GenerateResponse } from "../models/native-messaging/encrypted-message-responses/generate-response";
import { MessageResponseData } from "../models/native-messaging/encrypted-message-responses/message-response-data";
import { SuccessStatusResponse } from "../models/native-messaging/encrypted-message-responses/success-status-response";
import { UserStatusErrorResponse } from "../models/native-messaging/encrypted-message-responses/user-status-error-response";

export class EncryptedMessageHandlerService {
  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private cipherService: CipherService,
    private policyService: PolicyService,
    private messagingService: MessagingService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
  ) {}

  async responseDataForCommand(commandData: DecryptedCommandData): Promise<MessageResponseData> {
    const { command, payload } = commandData;
    switch (command) {
      case "bw-status": {
        return await this.statusCommandHandler();
      }
      case "bw-credential-retrieval": {
        return await this.credentialRetrievalCommandHandler(payload as CredentialRetrievePayload);
      }
      case "bw-credential-create": {
        return await this.credentialCreateCommandHandler(payload as CredentialCreatePayload);
      }
      case "bw-credential-update": {
        return await this.credentialUpdateCommandHandler(payload as CredentialUpdatePayload);
      }
      case "bw-generate-password": {
        return await this.generateCommandHandler(payload as PasswordGeneratePayload);
      }
      default:
        return {
          error: "cannot-decrypt",
        };
    }
  }

  private async checkUserStatus(userId: string): Promise<string> {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (userId !== activeUserId) {
      return "not-active-user";
    }

    const authStatus = await this.authService.getAuthStatus(activeUserId);
    if (authStatus !== AuthenticationStatus.Unlocked) {
      return "locked";
    }

    return "valid";
  }

  private async statusCommandHandler(): Promise<AccountStatusResponse[]> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (!accounts || !Object.keys(accounts)) {
      return [];
    }

    return Promise.all(
      Object.keys(accounts).map(async (userId: UserId) => {
        const authStatus = await this.authService.getAuthStatus(userId);
        const email = accounts[userId].email;

        return {
          id: userId,
          email,
          status: authStatus === AuthenticationStatus.Unlocked ? "unlocked" : "locked",
          active: userId === activeUserId,
        };
      }),
    );
  }

  private async credentialRetrievalCommandHandler(
    payload: CredentialRetrievePayload,
  ): Promise<CipherResponse[] | UserStatusErrorResponse> {
    if (payload.uri == null) {
      return [];
    }

    const ciphersResponse: CipherResponse[] = [];
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const authStatus = await this.authService.getAuthStatus(activeUserId);

    if (authStatus !== AuthenticationStatus.Unlocked) {
      return { error: "locked" };
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(payload.uri, activeUserId);
    ciphers.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));

    ciphers.forEach((c) => {
      ciphersResponse.push({
        userId: activeUserId,
        credentialId: c.id,
        userName: c.login.username,
        password: c.login.password,
        name: c.name,
      } as CipherResponse);
    });

    return ciphersResponse;
  }

  private async credentialCreateCommandHandler(
    payload: CredentialCreatePayload,
  ): Promise<SuccessStatusResponse | FailureStatusResponse | UserStatusErrorResponse> {
    const userStatus = await this.checkUserStatus(payload.userId);
    if (userStatus !== "valid") {
      return { error: userStatus } as UserStatusErrorResponse;
    }

    const credentialCreatePayload = payload as CredentialCreatePayload;

    if (
      credentialCreatePayload.name == null ||
      (await this.policyService.policyAppliesToUser(PolicyType.PersonalOwnership))
    ) {
      return { status: "failure" };
    }

    const cipherView = new CipherView();
    cipherView.type = CipherType.Login;
    cipherView.name = payload.name;
    cipherView.login = new LoginView();
    cipherView.login.password = credentialCreatePayload.password;
    cipherView.login.username = credentialCreatePayload.userName;
    cipherView.login.uris = [new LoginUriView()];
    cipherView.login.uris[0].uri = credentialCreatePayload.uri;

    try {
      const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      const encrypted = await this.cipherService.encrypt(cipherView, activeUserId);
      await this.cipherService.createWithServer(encrypted);

      // Notify other clients of new login
      await this.messagingService.send("addedCipher");
      // Refresh Desktop ciphers list
      await this.messagingService.send("refreshCiphers");

      return { status: "success" };
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return { status: "failure" };
    }
  }

  private async credentialUpdateCommandHandler(
    payload: CredentialUpdatePayload,
  ): Promise<SuccessStatusResponse | FailureStatusResponse | UserStatusErrorResponse> {
    const userStatus = await this.checkUserStatus(payload.userId);
    if (userStatus !== "valid") {
      return { error: userStatus } as UserStatusErrorResponse;
    }

    const credentialUpdatePayload = payload as CredentialUpdatePayload;

    if (credentialUpdatePayload.name == null) {
      return { status: "failure" };
    }

    try {
      const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

      const cipher = await this.cipherService.get(
        credentialUpdatePayload.credentialId,
        activeUserId,
      );
      if (cipher === null) {
        return { status: "failure" };
      }

      const cipherView = await cipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
      );
      cipherView.name = credentialUpdatePayload.name;
      cipherView.login.password = credentialUpdatePayload.password;
      cipherView.login.username = credentialUpdatePayload.userName;
      cipherView.login.uris[0].uri = credentialUpdatePayload.uri;
      const encrypted = await this.cipherService.encrypt(cipherView, activeUserId);

      await this.cipherService.updateWithServer(encrypted);

      // Notify other clients of update
      await this.messagingService.send("editedCipher");
      // Refresh Desktop ciphers list
      await this.messagingService.send("refreshCiphers");

      return { status: "success" };
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return { status: "failure" };
    }
  }

  private async generateCommandHandler(
    payload: PasswordGeneratePayload,
  ): Promise<GenerateResponse | UserStatusErrorResponse> {
    const userStatus = await this.checkUserStatus(payload.userId);
    if (userStatus !== "valid") {
      return { error: userStatus } as UserStatusErrorResponse;
    }

    const options = (await this.passwordGenerationService.getOptions())[0];
    const generatedValue = await this.passwordGenerationService.generatePassword(options);
    await this.passwordGenerationService.addHistory(generatedValue);

    return { password: generatedValue };
  }
}
