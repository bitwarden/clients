import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import {
  Fido2UserInterfaceService,
  Fido2UserVerificationService,
  UserInteractionRequired,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { mockAccountServiceWith, mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherListView } from "@bitwarden/sdk-internal";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

import {
  DesktopFido2UserInterfaceSession,
  NativeWindowObject,
} from "./desktop-fido2-user-interface.service";

describe("User Verification Tests", () => {
  const userId = "testId" as UserId;
  const activeAccountSubject = new BehaviorSubject<Account | null>({
    id: userId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
    }),
  });

  let abortController!: AbortController;
  let accountService!: AccountService;
  let authService!: MockProxy<AuthService>;
  let cipherService!: MockProxy<CipherService>;
  let desktopSettingsService!: MockProxy<DesktopSettingsService>;
  const logService = new ConsoleLogService();
  let nativeWindowObject!: NativeWindowObject;
  let router!: MockProxy<Router>;
  let userInterface!: MockProxy<Fido2UserInterfaceService<NativeWindowObject>>;
  let userInterfaceSession!: DesktopFido2UserInterfaceSession;
  let userVerificationService!: MockProxy<Fido2UserVerificationService>;
  const userVerification = true;
  const cipherId1 = "b8da924b-5f69-4d06-8a6f-2d7809e56bb9";
  const credId1 = "1234";
  const cipherId2 = "b48af562-a186-4131-92f5-ea09ef04d32d";
  const credId2 = "5678";

  const mockCiphers = [
    {
      id: cipherId1,
      name: "FidoCred1",
      type: {
        login: {
          hasFido2: true,
          fido2Credentials: [
            {
              credentialId: credId2,
              rpId: "example.com",
              userHandle: "5678",
              userName: "bobparr@acme.org",
              userDisplayName: "Robert Parr",
              counter: "0",
            },
          ],
          totp: undefined,
          uris: [],
        },
      },
    },
    {
      id: cipherId2,
      name: "FidoCred2",
      type: {
        login: {
          hasFido2: true,
          username: undefined,
          fido2Credentials: [
            {
              credentialId: credId1,
              rpId: "example.com",
              userHandle: "1234",
              userName: "mr.incredible@heroes.com",
              userDisplayName: "Mr. Incredible",
              counter: "0",
            },
          ],
          totp: undefined,
          uris: [],
        },
      },
    },
  ] as unknown as CipherListView[];

  beforeEach(async () => {
    authService = mock<AuthService>();
    accountService = mockAccountServiceWith(userId);
    cipherService = mock<CipherService>();
    cipherService.cipherListViews$.mockReturnValue(of(mockCiphers));

    desktopSettingsService = mock<DesktopSettingsService>();
    userInterface = mock<Fido2UserInterfaceService<NativeWindowObject>>();
    userInterface.newSession.mockResolvedValue(userInterfaceSession);
    userVerificationService = mock<Fido2UserVerificationService>();

    abortController = new AbortController();
    accountService.activeAccount$ = activeAccountSubject;
    nativeWindowObject = {
      windowXy: { x: 640, y: 480 },
      handle: new Uint8Array([6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    };
    transactionContext = "AABBCCDDEE==";
    userInterfaceSession = new DesktopFido2UserInterfaceSession(
      authService,
      cipherService,
      accountService,
      logService,
      router,
      desktopSettingsService,
      userVerificationService,
      nativeWindowObject,
      abortController,
    );
  });
  describe("UserInteractionRequired on silent assertion", () => {
    it("throws when more than one credential found", async () => {
      await expect(
        async () =>
          await userInterfaceSession.pickCredential({
            cipherIds: [cipherId1, cipherId2],
            userVerification,
            assumeUserPresence: false,
            isSilent: true,
            masterPasswordRepromptRequired: false,
          }),
      ).rejects.toThrow(UserInteractionRequired);
    });

    it("throws when master password reprompt required", async () => {
      await expect(
        async () =>
          await userInterfaceSession.pickCredential({
            cipherIds: [cipherId1],
            userVerification,
            assumeUserPresence: false,
            isSilent: true,
            masterPasswordRepromptRequired: true,
          }),
      ).rejects.toThrow(UserInteractionRequired);
    });

    it("throws when neither userVerification nor assumeUserPresence is true", async () => {
      await expect(
        async () =>
          await userInterfaceSession.pickCredential({
            cipherIds: [cipherId1],
            userVerification: false,
            assumeUserPresence: false,
            isSilent: true,
            masterPasswordRepromptRequired: false,
          }),
      ).rejects.toThrow(UserInteractionRequired);
    });

    it("throws when user verification prompt fails", async () => {
      userVerificationService.promptForUserVerification.mockRejectedValue("user cancelled");
      await expect(
        async () =>
          await userInterfaceSession.pickCredential({
            cipherIds: [cipherId1],
            userVerification,
            assumeUserPresence: false,
            isSilent: true,
            masterPasswordRepromptRequired: false,
          }),
      ).rejects.toThrow(UserInteractionRequired);
    });
  });

  it("succeeds when user verification succeeds", async () => {
    userVerificationService.promptForUserVerification.mockResolvedValue(true);
    const { cipherId, userVerified } = await userInterfaceSession.pickCredential({
      cipherIds: [cipherId1],
      userVerification,
      assumeUserPresence: false,
      isSilent: true,
      masterPasswordRepromptRequired: false,
    });
    expect(cipherId).toStrictEqual(cipherId1);
    expect(userVerified).toStrictEqual(true);
  });
});
