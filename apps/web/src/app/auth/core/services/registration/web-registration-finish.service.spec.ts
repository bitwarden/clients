import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PasswordInputResult } from "@bitwarden/auth/angular";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import {
  DirectOrganizationInvite,
  OpenOrganizationInvite,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordUnlockData,
  MasterPasswordSalt,
  MasterPasswordAuthenticationHash,
  MasterKeyWrappedUserKey,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import {
  DEFAULT_KDF_CONFIG,
  EncString,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { WebRegistrationFinishService } from "./web-registration-finish.service";

describe("WebRegistrationFinishService", () => {
  let service: WebRegistrationFinishService;

  let legacyCompatKeyService: MockProxy<LegacyCompatKeyService>;
  let accountApiService: MockProxy<AccountApiService>;
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let masterPasswordService: MockProxy<MasterPasswordServiceAbstraction>;
  let configService: MockProxy<ConfigService>;
  let sdkService: MockProxy<SdkService>;

  // Reassigned inside sdkVariant.setupMocks; declared here so tests can read from it.
  let postKeysForUserPasswordRegistration: jest.Mock;

  // Reassigned inside legacyVariant.setupMocks. The legacy-only test uses these to
  // assert argument identity through the key-derivation pipeline (makeUserKey is
  // called with the value returned by makeMasterKey; makeKeyPair with the value
  // returned by makeUserKey).
  let legacyMasterKey: MasterKey;
  let legacyUserKey: UserKey;

  beforeEach(() => {
    legacyCompatKeyService = mock<LegacyCompatKeyService>();
    accountApiService = mock<AccountApiService>();
    organizationInviteService = mock<OrganizationInviteService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();
    configService = mock<ConfigService>();
    sdkService = mock<SdkService>();

    service = new WebRegistrationFinishService(
      legacyCompatKeyService,
      accountApiService,
      masterPasswordService,
      configService,
      sdkService,
      organizationInviteService,
    );

    configService.getFeatureFlag.mockResolvedValue(false);
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  // ============================================================================
  // finishRegistration() — shared across the legacy and SDK flows.
  //
  // The service picks a path via the
  // `EnableAccountEncryptionV2UserPasswordRegistration` feature flag:
  //   - legacy (flag off): derives keys client-side, POSTs a camelCased
  //     RegisterFinishRequest via accountApiService.registerFinish.
  //   - SDK (flag on): delegates to post_keys_for_user_password_registration
  //     with a snake_cased request.
  //
  // Behavior is functionally identical from the caller's perspective; the two
  // flows only differ in transport + field-name casing. Shared behavior is
  // exercised once via describe.each; flow-specific safeguards (key derivation,
  // SDK availability, UUID validation) live in their own describes below.
  // ============================================================================

  interface FlowVariant {
    label: string;
    setupMocks: () => void;
    // Request shape differs between flows (RegisterFinishRequest for legacy,
    // UserMasterPasswordRegistrationRequest for SDK). Tests read fields by name
    // via the `fields` map, so an untyped index accessor is intentional here.
    getRequest: () => any;
    expectTransportNotCalled: () => void;
    directOrgInvite: DirectOrganizationInvite;
    emergencyAccessId: string;
    providerUserId: string;
    // Field names on the outbound request (camelCase on legacy, snake_case on SDK).
    fields: {
      orgInviteToken: string;
      orgUserId: string;
      orgSponsoredFreeFamilyPlanToken: string;
      acceptEmergencyAccessInviteToken: string;
      acceptEmergencyAccessId: string;
      providerInviteToken: string;
      providerUserId: string;
      salesAssistedToken: string;
      emailVerificationToken: string;
      openOrgInvite: string;
    };
    // Field names inside the openOrgInvite/open_org_invite nested object
    // (camelCase on legacy, snake_case on SDK).
    openOrgInviteFields: {
      organizationId: string;
      code: string;
    };
  }

  const legacyVariant: FlowVariant = {
    label: "legacy flow",
    setupMocks: () => {
      legacyMasterKey = new SymmetricCryptoKey(new Uint8Array(64)) as MasterKey;
      legacyUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const userKeyEncString = new EncString("userKeyEncrypted");
      const userKeyPair: [string, EncString] = ["publicKey", new EncString("privateKey")];
      const salt = "salt" as MasterPasswordSalt;

      legacyCompatKeyService.makeMasterKey.mockResolvedValue(legacyMasterKey);
      legacyCompatKeyService.makeUserKey.mockResolvedValue([legacyUserKey, userKeyEncString]);
      legacyCompatKeyService.makeKeyPair.mockResolvedValue(userKeyPair);
      accountApiService.registerFinish.mockResolvedValue();
      configService.getFeatureFlag.mockImplementation((flag) =>
        Promise.resolve(flag === FeatureFlag.GenerateInviteLink),
      );

      masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue({
        salt,
        kdf: DEFAULT_KDF_CONFIG,
        masterPasswordAuthenticationHash: "authHash" as MasterPasswordAuthenticationHash,
      });
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(
        new MasterPasswordUnlockData(
          salt,
          DEFAULT_KDF_CONFIG,
          "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
        ),
      );
    },
    getRequest: () => accountApiService.registerFinish.mock.calls[0][0] as RegisterFinishRequest,
    expectTransportNotCalled: () => {
      expect(accountApiService.registerFinish).not.toHaveBeenCalled();
    },
    directOrgInvite: new DirectOrganizationInvite({
      organizationId: "organizationId",
      organizationUserId: "organizationUserId",
      token: "orgInviteToken",
      email: "email",
      organizationName: "organizationName",
      initOrganization: false,
      orgUserHasExistingUser: false,
    }),
    emergencyAccessId: "emergencyAccessId",
    providerUserId: "providerUserId",
    fields: {
      orgInviteToken: "orgInviteToken",
      orgUserId: "organizationUserId",
      orgSponsoredFreeFamilyPlanToken: "orgSponsoredFreeFamilyPlanToken",
      acceptEmergencyAccessInviteToken: "acceptEmergencyAccessInviteToken",
      acceptEmergencyAccessId: "acceptEmergencyAccessId",
      providerInviteToken: "providerInviteToken",
      providerUserId: "providerUserId",
      salesAssistedToken: "salesAssistedToken",
      emailVerificationToken: "emailVerificationToken",
      openOrgInvite: "openOrgInvite",
    },
    openOrgInviteFields: {
      organizationId: "organizationId",
      code: "code",
    },
  };

  const sdkVariant: FlowVariant = {
    label: "SDK flow",
    setupMocks: () => {
      configService.getFeatureFlag.mockImplementation((flag) =>
        Promise.resolve(
          flag === FeatureFlag.EnableAccountEncryptionV2UserPasswordRegistration ||
            flag === FeatureFlag.GenerateInviteLink,
        ),
      );

      postKeysForUserPasswordRegistration = jest.fn().mockResolvedValue(undefined);
      const registrationClient = {
        post_keys_for_user_password_registration: postKeysForUserPasswordRegistration,
      };
      const authClient = { registration: jest.fn().mockReturnValue(registrationClient) };
      const sdkClient = { auth: jest.fn().mockReturnValue(authClient) };
      sdkService.client$ = of(sdkClient as any);
    },
    getRequest: () => postKeysForUserPasswordRegistration.mock.calls[0][0],
    expectTransportNotCalled: () => {
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    },
    // The SDK request converts ids via asUuid, so fixtures must be valid UUIDs here.
    directOrgInvite: new DirectOrganizationInvite({
      organizationId: "organizationId",
      organizationUserId: "00000000-0000-0000-0000-000000000003",
      token: "orgInviteToken",
      email: "email",
      organizationName: "organizationName",
      initOrganization: false,
      orgUserHasExistingUser: false,
    }),
    emergencyAccessId: "00000000-0000-0000-0000-000000000001",
    providerUserId: "00000000-0000-0000-0000-000000000002",
    fields: {
      orgInviteToken: "org_invite_token",
      orgUserId: "organization_user_id",
      orgSponsoredFreeFamilyPlanToken: "org_sponsored_free_family_plan_token",
      acceptEmergencyAccessInviteToken: "accept_emergency_access_invite_token",
      acceptEmergencyAccessId: "accept_emergency_access_id",
      providerInviteToken: "provider_invite_token",
      providerUserId: "provider_user_id",
      salesAssistedToken: "sales_assisted_token",
      emailVerificationToken: "email_verification_token",
      openOrgInvite: "open_org_invite",
    },
    openOrgInviteFields: {
      organizationId: "organization_id",
      code: "code",
    },
  };

  describe.each([legacyVariant, sdkVariant])("finishRegistration() - $label", (variant) => {
    const email = "test@email.com";
    const emailVerificationToken = "emailVerificationToken";
    const orgSponsoredFreeFamilyPlanToken = "orgSponsoredFreeFamilyPlanToken";
    const acceptEmergencyAccessInviteToken = "acceptEmergencyAccessInviteToken";
    const providerInviteToken = "providerInviteToken";
    const salesAssistedToken = "salesAssistedToken";
    const passwordInputResult: PasswordInputResult = {
      newPassword: "newPassword",
      kdfConfig: DEFAULT_KDF_CONFIG,
      newPasswordHint: "newPasswordHint",
      salt: "salt" as MasterPasswordSalt,
    };

    beforeEach(() => {
      variant.setupMocks();
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);
    });

    it("submits a register request carrying the email verification token", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      const request = variant.getRequest();
      expect(request[variant.fields.emailVerificationToken]).toEqual(emailVerificationToken);
    });

    it("populates direct-invite fields on the request when a direct org invite is stashed", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(variant.directOrgInvite);

      await service.finishRegistration(email, passwordInputResult);

      const request = variant.getRequest();
      expect(request[variant.fields.orgInviteToken]).toEqual(variant.directOrgInvite.token);
      expect(request[variant.fields.orgUserId]).toEqual(variant.directOrgInvite.organizationUserId);
      expect(request).toMatchSnapshot();
    });

    it("populates open-org-invite fields and skips direct-invite fields when a stashed open org invite is active", async () => {
      // Open invites carry the invite link reference (not the per-user credentials of a
      // direct invite). The kind-guarded write path must set the open-invite fields and
      // leave direct-invite fields untouched.
      const openOrgInvite = new OpenOrganizationInvite({
        // The SDK request converts organization_id via asUuid, so the fixture must
        // be a valid UUID.
        organizationId: "00000000-0000-0000-0000-000000000010",
        inviteLinkCode: "00000000-0000-0000-0000-000000000011",
        inviteKey: "link-key",
        organizationName: "openOrgName",
      });
      organizationInviteService.getOrganizationInvite.mockResolvedValue(openOrgInvite);

      await service.finishRegistration(email, passwordInputResult);

      const request = variant.getRequest();
      expect(request[variant.fields.orgInviteToken]).toBeUndefined();
      expect(request[variant.fields.orgUserId]).toBeUndefined();
      expect(request[variant.fields.openOrgInvite]).toEqual({
        [variant.openOrgInviteFields.organizationId]: openOrgInvite.organizationId,
        [variant.openOrgInviteFields.code]: openOrgInvite.inviteLinkCode,
      });
      expect(request).toMatchSnapshot();
    });

    it("does not populate open-org-invite fields when no invite is stashed", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      await service.finishRegistration(email, passwordInputResult);

      const request = variant.getRequest();
      expect(request[variant.fields.openOrgInvite]).toBeUndefined();
    });

    it("does not populate open-org-invite fields when a direct org invite is stashed", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(variant.directOrgInvite);

      await service.finishRegistration(email, passwordInputResult);

      const request = variant.getRequest();
      expect(request[variant.fields.openOrgInvite]).toBeUndefined();
    });

    it("does not populate open-org-invite fields when GenerateInviteLink flag is off, even if an open invite is stashed", async () => {
      // Defense in depth: an open invite stashed while the flag was on must not leak
      // into a flag-off session.
      configService.getFeatureFlag.mockImplementation((flag) =>
        Promise.resolve(
          flag === FeatureFlag.EnableAccountEncryptionV2UserPasswordRegistration &&
            variant.label === "SDK flow",
        ),
      );
      organizationInviteService.getOrganizationInvite.mockResolvedValue(
        new OpenOrganizationInvite({
          organizationId: "00000000-0000-0000-0000-000000000010",
          inviteLinkCode: "00000000-0000-0000-0000-000000000011",
          inviteKey: "link-key",
          organizationName: "openOrgName",
        }),
      );

      await service.finishRegistration(email, passwordInputResult);

      const request = variant.getRequest();
      expect(request[variant.fields.openOrgInvite]).toBeUndefined();
    });

    it("does not throw the mutual-exclusion error when emailVerificationToken is present alongside a stashed open org invite", async () => {
      // Sealed-open-org-invite crossing invariant: registration-finish arrives with
      // BOTH the verification token (from the email link) AND an open invite in
      // state (unsealed from the blob). Open invites don't set any direct-invite /
      // family / emergency / provider / sales-assisted token, so the guard must
      // let this through, and both the verification token and the open-invite
      // context must survive to the server.
      const openOrgInvite = new OpenOrganizationInvite({
        organizationId: "00000000-0000-0000-0000-000000000010",
        inviteLinkCode: "00000000-0000-0000-0000-000000000011",
        inviteKey: "link-key",
        organizationName: "openOrgName",
      });
      organizationInviteService.getOrganizationInvite.mockResolvedValue(openOrgInvite);

      await expect(
        service.finishRegistration(email, passwordInputResult, emailVerificationToken),
      ).resolves.not.toThrow();
      const request = variant.getRequest();
      expect(request[variant.fields.emailVerificationToken]).toEqual(emailVerificationToken);
      expect(request[variant.fields.openOrgInvite]).toEqual({
        [variant.openOrgInviteFields.organizationId]: openOrgInvite.organizationId,
        [variant.openOrgInviteFields.code]: openOrgInvite.inviteLinkCode,
      });
    });

    it("forwards the org-sponsored free family plan token", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        undefined,
        orgSponsoredFreeFamilyPlanToken,
      );

      const request = variant.getRequest();
      expect(request[variant.fields.orgSponsoredFreeFamilyPlanToken]).toEqual(
        orgSponsoredFreeFamilyPlanToken,
      );
      expect(request).toMatchSnapshot();
    });

    it("forwards the emergency-access fields when both invite token and access id are provided", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        undefined,
        undefined,
        acceptEmergencyAccessInviteToken,
        variant.emergencyAccessId,
      );

      const request = variant.getRequest();
      expect(request[variant.fields.acceptEmergencyAccessInviteToken]).toEqual(
        acceptEmergencyAccessInviteToken,
      );
      expect(request[variant.fields.acceptEmergencyAccessId]).toEqual(variant.emergencyAccessId);
      expect(request).toMatchSnapshot();
    });

    it("forwards the provider-invite fields when both token and user id are provided", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        undefined,
        undefined,
        undefined,
        undefined,
        providerInviteToken,
        variant.providerUserId,
      );

      const request = variant.getRequest();
      expect(request[variant.fields.providerInviteToken]).toEqual(providerInviteToken);
      expect(request[variant.fields.providerUserId]).toEqual(variant.providerUserId);
      expect(request).toMatchSnapshot();
    });

    it("forwards the sales-assisted token", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        salesAssistedToken,
      );

      const request = variant.getRequest();
      expect(request[variant.fields.salesAssistedToken]).toEqual(salesAssistedToken);
    });

    describe("rejects emailVerificationToken alongside an alternative invite/acceptance token", () => {
      it.each([
        {
          alternative: "direct org invite token",
          setup: (v: FlowVariant) =>
            organizationInviteService.getOrganizationInvite.mockResolvedValue(v.directOrgInvite),
          extraArgs: () => [] as unknown[],
        },
        {
          alternative: "org-sponsored free family plan token",
          setup: () => undefined,
          extraArgs: () => [orgSponsoredFreeFamilyPlanToken] as unknown[],
        },
        {
          alternative: "emergency-access invite token",
          setup: () => undefined,
          extraArgs: (v: FlowVariant) =>
            [undefined, acceptEmergencyAccessInviteToken, v.emergencyAccessId] as unknown[],
        },
        {
          alternative: "provider invite token",
          setup: () => undefined,
          extraArgs: (v: FlowVariant) =>
            [undefined, undefined, undefined, providerInviteToken, v.providerUserId] as unknown[],
        },
        {
          alternative: "sales-assisted token",
          setup: () => undefined,
          extraArgs: () =>
            [
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              salesAssistedToken,
            ] as unknown[],
        },
      ])(
        "throws and does not submit the request when $alternative is also present",
        async ({ setup, extraArgs }) => {
          setup(variant);
          const extras = extraArgs(variant);

          await expect(
            service.finishRegistration(
              email,
              passwordInputResult,
              emailVerificationToken,
              ...(extras as [
                string | undefined,
                string | undefined,
                string | undefined,
                string | undefined,
                string | undefined,
                string | undefined,
              ]),
            ),
          ).rejects.toThrow(
            "emailVerificationToken and alternative invite token simultaneously detected. Could not finish registration.",
          );
          variant.expectTransportNotCalled();
        },
      );
    });

    describe("does not set a paired token/id pair when only half is provided", () => {
      it.each([
        {
          missingHalf: "the emergency-access invite token (id provided alone)",
          extraArgs: (v: FlowVariant) =>
            [undefined, undefined, undefined, v.emergencyAccessId] as unknown[],
          tokenField: (v: FlowVariant) => v.fields.acceptEmergencyAccessInviteToken,
          idField: (v: FlowVariant) => v.fields.acceptEmergencyAccessId,
        },
        {
          missingHalf: "the emergency-access id (token provided alone)",
          extraArgs: () =>
            [undefined, undefined, acceptEmergencyAccessInviteToken, undefined] as unknown[],
          tokenField: (v: FlowVariant) => v.fields.acceptEmergencyAccessInviteToken,
          idField: (v: FlowVariant) => v.fields.acceptEmergencyAccessId,
        },
        {
          missingHalf: "the provider user id (token provided alone)",
          extraArgs: () =>
            [
              undefined,
              undefined,
              undefined,
              undefined,
              providerInviteToken,
              undefined,
            ] as unknown[],
          tokenField: (v: FlowVariant) => v.fields.providerInviteToken,
          idField: (v: FlowVariant) => v.fields.providerUserId,
        },
        {
          missingHalf: "the provider invite token (user id provided alone)",
          extraArgs: (v: FlowVariant) =>
            [undefined, undefined, undefined, undefined, undefined, v.providerUserId] as unknown[],
          tokenField: (v: FlowVariant) => v.fields.providerInviteToken,
          idField: (v: FlowVariant) => v.fields.providerUserId,
        },
      ])(
        "leaves both fields unset when $missingHalf",
        async ({ extraArgs, tokenField, idField }) => {
          const extras = extraArgs(variant);

          await service.finishRegistration(
            email,
            passwordInputResult,
            ...(extras as [
              string | undefined,
              string | undefined,
              string | undefined,
              string | undefined,
              string | undefined,
              string | undefined,
            ]),
          );

          const request = variant.getRequest();
          expect(request[tokenField(variant)]).toBeUndefined();
          expect(request[idField(variant)]).toBeUndefined();
        },
      );
    });
  });

  // ============================================================================
  // finishRegistration() — flow-specific safeguards.
  // ============================================================================

  describe("finishRegistration() — legacy flow only", () => {
    const email = "test@email.com";
    const emailVerificationToken = "emailVerificationToken";
    const passwordInputResult: PasswordInputResult = {
      newPassword: "newPassword",
      kdfConfig: DEFAULT_KDF_CONFIG,
      newPasswordHint: "newPasswordHint",
      salt: "salt" as MasterPasswordSalt,
    };

    beforeEach(() => {
      legacyVariant.setupMocks();
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);
    });

    it("throws when the user key cannot be created", async () => {
      legacyCompatKeyService.makeUserKey.mockResolvedValue([
        null as unknown as UserKey,
        null as unknown as EncString,
      ]);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow(
        "User key could not be created",
      );
    });

    it("derives the master key + user key + key pair and posts a RegisterFinishRequest", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      // Verifies the key-derivation pipeline wiring: each step consumes the output
      // of the previous one (masterKey → makeUserKey → userKey → makeKeyPair).
      expect(legacyCompatKeyService.makeMasterKey).toHaveBeenCalledWith(
        passwordInputResult.newPassword,
        passwordInputResult.salt,
        passwordInputResult.kdfConfig,
      );
      expect(legacyCompatKeyService.makeUserKey).toHaveBeenCalledWith(legacyMasterKey);
      expect(legacyCompatKeyService.makeKeyPair).toHaveBeenCalledWith(legacyUserKey);

      const registerCall = accountApiService.registerFinish.mock
        .calls[0][0] as RegisterFinishRequest;
      expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
      expect(registerCall.masterPasswordAuthentication).toBeDefined();
      expect(registerCall.masterPasswordUnlock).toBeDefined();
      expect(registerCall).toMatchSnapshot();
    });
  });

  describe("finishRegistration() — SDK flow only", () => {
    const email = "test@email.com";
    const emailVerificationToken = "emailVerificationToken";
    const passwordInputResult: PasswordInputResult = {
      newPassword: "newPassword",
      kdfConfig: DEFAULT_KDF_CONFIG,
      newPasswordHint: "newPasswordHint",
      salt: "salt" as MasterPasswordSalt,
    };

    beforeEach(() => {
      sdkVariant.setupMocks();
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);
    });

    it("throws when the SDK client is not available", async () => {
      sdkService.client$ = of(null as any);

      await expect(
        service.finishRegistration(email, passwordInputResult, emailVerificationToken),
      ).rejects.toThrow("SDK not available");
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("delegates to the SDK's post_keys_for_user_password_registration and does not exercise the legacy path", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      const sdkRequest = postKeysForUserPasswordRegistration.mock.calls[0][0];
      expect(sdkRequest).toEqual(
        expect.objectContaining({
          email,
          salt: passwordInputResult.salt,
          master_password: passwordInputResult.newPassword,
          master_password_hint: passwordInputResult.newPasswordHint,
          email_verification_token: emailVerificationToken,
        }),
      );
      expect(legacyCompatKeyService.makeMasterKey).not.toHaveBeenCalled();
      expect(legacyCompatKeyService.makeUserKey).not.toHaveBeenCalled();
      expect(legacyCompatKeyService.makeKeyPair).not.toHaveBeenCalled();
      expect(accountApiService.registerFinish).not.toHaveBeenCalled();
      expect(sdkRequest).toMatchSnapshot();
    });

    it("throws when the org invite's organizationUserId is not a valid UUID", async () => {
      const badOrgInvite = new DirectOrganizationInvite({
        organizationId: "organizationId",
        organizationUserId: "not-a-uuid",
        token: "orgInviteToken",
        email: "email",
        organizationName: "organizationName",
        initOrganization: false,
        orgUserHasExistingUser: false,
      });
      organizationInviteService.getOrganizationInvite.mockResolvedValue(badOrgInvite);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow();
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("throws when the open org invite's organizationId is not a valid UUID", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(
        new OpenOrganizationInvite({
          organizationId: "not-a-uuid",
          inviteLinkCode: "00000000-0000-0000-0000-000000000020",
          inviteKey: "link-key",
          organizationName: "openOrgName",
        }),
      );

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow();
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("throws when the emergency access id is not a valid UUID", async () => {
      await expect(
        service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          undefined,
          "acceptEmergencyAccessInviteToken",
          "not-a-uuid",
        ),
      ).rejects.toThrow();
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("throws when the provider user id is not a valid UUID", async () => {
      await expect(
        service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          undefined,
          undefined,
          undefined,
          "providerInviteToken",
          "not-a-uuid",
        ),
      ).rejects.toThrow();
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("propagates SDK errors", async () => {
      postKeysForUserPasswordRegistration.mockRejectedValue(new Error("sdk boom"));
      await expect(
        service.finishRegistration(email, passwordInputResult, emailVerificationToken),
      ).rejects.toThrow("sdk boom");
    });
  });
});
