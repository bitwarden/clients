import { TextEncoder } from "util";

import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { mockAccountServiceWith } from "../../../../spec";
import { Account } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { CipherRepromptType } from "../../../vault/enums/cipher-reprompt-type";
import { CipherType } from "../../../vault/enums/cipher-type";
import { Cipher } from "../../../vault/models/domain/cipher";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { LoginView } from "../../../vault/models/view/login.view";
import {
  Fido2AuthenticatorErrorCode,
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorMakeCredentialsParams,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import {
  Fido2UserInterfaceService,
  Fido2UserInterfaceSession,
  NewCredentialParams,
} from "../../abstractions/fido2/fido2-user-interface.service.abstraction";
import { Utils } from "../../misc/utils";

import { CBOR } from "./cbor";
import { parseCredentialId } from "./credential-id-utils";
import { AAGUID, Fido2AuthenticatorService } from "./fido2-authenticator.service";
import { Fido2Utils } from "./fido2-utils";

type ParentWindowReference = string;

const RpId = "bitwarden.com";

describe("FidoAuthenticatorService", () => {
  const activeAccountSubject = new BehaviorSubject<Account | null>({
    id: "testId" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  });

  let cipherService!: MockProxy<CipherService>;
  let userInterface!: MockProxy<Fido2UserInterfaceService<ParentWindowReference>>;
  let userInterfaceSession!: MockProxy<Fido2UserInterfaceSession>;
  let syncService!: MockProxy<SyncService>;
  let authenticator!: Fido2AuthenticatorService<ParentWindowReference>;
  let windowReference!: ParentWindowReference;

  beforeEach(async () => {
    cipherService = mock<CipherService>();
    userInterface = mock<Fido2UserInterfaceService<ParentWindowReference>>();
    userInterfaceSession = mock<Fido2UserInterfaceSession>();
    userInterface.newSession.mockResolvedValue(userInterfaceSession);
    syncService = mock<SyncService>({
      activeUserLastSync$: () => of(new Date()),
    });
    const accountService = mockAccountServiceWith("testId" as UserId);
    authenticator = new Fido2AuthenticatorService(
      cipherService,
      userInterface,
      syncService,
      accountService,
    );
    windowReference = Utils.newGuid();
    accountService.activeAccount$ = activeAccountSubject;
  });

  describe("makeCredential", () => {
    let invalidParams!: InvalidParams;

    beforeEach(async () => {
      invalidParams = await createInvalidParams();
    });

    describe("invalid input parameters", () => {
      // Spec: Check if at least one of the specified combinations of PublicKeyCredentialType and cryptographic parameters in credTypesAndPubKeyAlgs is supported. If not, return an error code equivalent to "NotSupportedError" and terminate the operation.
      it("should throw error when input does not contain any supported algorithms", async () => {
        const result = async () =>
          await authenticator.makeCredential(invalidParams.unsupportedAlgorithm, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.NotSupported);
      });

      it("should throw error when requireResidentKey has invalid value", async () => {
        const result = async () =>
          await authenticator.makeCredential(invalidParams.invalidRk, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Unknown);
      });

      it("should throw error when requireUserVerification has invalid value", async () => {
        const result = async () =>
          await authenticator.makeCredential(invalidParams.invalidUv, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Unknown);
      });

      /**
       * Spec: If requireUserVerification is true and the authenticator cannot perform user verification, return an error code equivalent to "ConstraintError" and terminate the operation.
       * Deviation: User verification is checked before checking for excluded credentials
       **/
      /** TODO: This test should only be activated if we disable support for user verification */
      it.skip("should throw error if requireUserVerification is set to true", async () => {
        const params = await createParams({ requireUserVerification: true });

        const result = async () => await authenticator.makeCredential(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Constraint);
      });

      it("should not request confirmation from user", async () => {
        userInterfaceSession.confirmNewCredential.mockResolvedValue({
          cipherId: "75280e7e-a72e-4d6c-bf1e-d37238352f9b",
          userVerified: false,
        });
        const invalidParams = await createInvalidParams();

        for (const p of Object.values(invalidParams)) {
          try {
            await authenticator.makeCredential(p, windowReference);
            // eslint-disable-next-line no-empty
          } catch {}
        }
        expect(userInterfaceSession.confirmNewCredential).not.toHaveBeenCalled();
      });
    });

    describe.skip("when extensions parameter is present", () => undefined);

    describe("vault contains excluded credential", () => {
      let excludedCipher: CipherView;
      let params: Fido2AuthenticatorMakeCredentialsParams;

      beforeEach(async () => {
        excludedCipher = createCipherView(
          { type: CipherType.Login },
          { credentialId: Utils.newGuid() },
        );
        params = await createParams({
          excludeCredentialDescriptorList: [
            {
              id: parseCredentialId(excludedCipher.login.fido2Credentials[0].credentialId),
              type: "public-key",
            },
          ],
        });
        cipherService.get.mockImplementation(async (id) =>
          id === excludedCipher.id ? ({ decrypt: () => excludedCipher } as any) : undefined,
        );
        cipherService.getAllDecrypted.mockResolvedValue([excludedCipher]);
      });

      /**
       * Spec: collect an authorization gesture confirming user consent for creating a new credential.
       * Deviation: Consent is not asked and the user is simply informed of the situation.
       **/
      it("should inform user", async () => {
        userInterfaceSession.informExcludedCredential.mockResolvedValue();

        try {
          await authenticator.makeCredential(params, windowReference);
          // eslint-disable-next-line no-empty
        } catch {}

        expect(userInterfaceSession.informExcludedCredential).toHaveBeenCalled();
      });

      /** Spec: return an error code equivalent to "NotAllowedError" and terminate the operation. */
      it("should throw error", async () => {
        userInterfaceSession.informExcludedCredential.mockResolvedValue();

        const result = async () => await authenticator.makeCredential(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.NotAllowed);
      });

      /** Devation: Organization ciphers are not checked against excluded credentials, even if the user has access to them. */
      it("should not inform user of duplication when the excluded credential belongs to an organization", async () => {
        userInterfaceSession.informExcludedCredential.mockResolvedValue();
        excludedCipher.organizationId = "someOrganizationId";

        try {
          await authenticator.makeCredential(params, windowReference);
          // eslint-disable-next-line no-empty
        } catch {}

        expect(userInterfaceSession.informExcludedCredential).not.toHaveBeenCalled();
      });

      it("should not inform user of duplication when input data does not pass checks", async () => {
        userInterfaceSession.informExcludedCredential.mockResolvedValue();
        const invalidParams = await createInvalidParams();

        for (const p of Object.values(invalidParams)) {
          try {
            await authenticator.makeCredential(p, windowReference);
            // eslint-disable-next-line no-empty
          } catch {}
        }
        expect(userInterfaceSession.informExcludedCredential).not.toHaveBeenCalled();
      });

      it.todo(
        "should not throw error if the excluded credential has been marked as deleted in the vault",
      );
    });

    describe("credential creation", () => {
      let existingCipher: CipherView;
      let params: Fido2AuthenticatorMakeCredentialsParams;

      beforeEach(async () => {
        existingCipher = createCipherView({ type: CipherType.Login });
        params = await createParams({ requireResidentKey: false });
        cipherService.get.mockImplementation(async (id) =>
          id === existingCipher.id ? ({ decrypt: () => existingCipher } as any) : undefined,
        );
        cipherService.getAllDecrypted.mockResolvedValue([existingCipher]);
      });

      /**
       * Spec: Collect an authorization gesture confirming user consent for creating a new credential. The prompt for the authorization gesture is shown by the authenticator if it has its own output capability. The prompt SHOULD display rpEntity.id, rpEntity.name, userEntity.name and userEntity.displayName, if possible.
       * Deviation: Only `rpEntity.name` and `userEntity.name` is shown.
       * */
      for (const userVerification of [true, false]) {
        it(`should request confirmation from user when user verification is ${userVerification}`, async () => {
          params.requireUserVerification = userVerification;
          userInterfaceSession.confirmNewCredential.mockResolvedValue({
            cipherId: existingCipher.id,
            userVerified: userVerification,
          });

          await authenticator.makeCredential(params, windowReference);

          expect(userInterfaceSession.confirmNewCredential).toHaveBeenCalledWith({
            credentialName: params.rpEntity.name,
            userName: params.userEntity.name,
            userHandle: Fido2Utils.bufferToString(params.userEntity.id),
            userVerification,
            rpId: params.rpEntity.id,
          } as NewCredentialParams);
        });
      }

      it("should save credential to vault if request confirmed by user", async () => {
        const encryptedCipher = Symbol();
        userInterfaceSession.confirmNewCredential.mockResolvedValue({
          cipherId: existingCipher.id,
          userVerified: false,
        });
        cipherService.encrypt.mockResolvedValue(encryptedCipher as unknown as Cipher);

        await authenticator.makeCredential(params, windowReference);

        const saved = cipherService.encrypt.mock.lastCall?.[0];
        expect(saved).toEqual(
          expect.objectContaining({
            type: CipherType.Login,
            name: existingCipher.name,

            login: expect.objectContaining({
              fido2Credentials: [
                expect.objectContaining({
                  credentialId: expect.anything(),
                  keyType: "public-key",
                  keyAlgorithm: "ECDSA",
                  keyCurve: "P-256",
                  rpId: params.rpEntity.id,
                  rpName: params.rpEntity.name,
                  userHandle: Fido2Utils.bufferToString(params.userEntity.id),
                  userName: params.userEntity.name,
                  counter: 0,
                  userDisplayName: params.userEntity.displayName,
                  discoverable: false,
                }),
              ],
            }),
          }),
        );
        expect(cipherService.updateWithServer).toHaveBeenCalledWith(encryptedCipher);
      });

      /** Spec: If the user does not consent or if user verification fails, return an error code equivalent to "NotAllowedError" and terminate the operation. */
      it("should throw error if user denies creation request", async () => {
        userInterfaceSession.confirmNewCredential.mockResolvedValue({
          cipherId: undefined,
          userVerified: false,
        });
        const params = await createParams();

        const result = async () => await authenticator.makeCredential(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.NotAllowed);
      });

      it("should throw error if user verification fails and cipher requires reprompt", async () => {
        params.requireUserVerification = false;
        userInterfaceSession.confirmNewCredential.mockResolvedValue({
          cipherId: existingCipher.id,
          userVerified: false,
        });
        const encryptedCipher = { ...existingCipher, reprompt: CipherRepromptType.Password };
        cipherService.get.mockResolvedValue(encryptedCipher as unknown as Cipher);

        const result = async () => await authenticator.makeCredential(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Unknown);
      });

      /** Spec: If any error occurred while creating the new credential object, return an error code equivalent to "UnknownError" and terminate the operation. */
      it("should throw unkown error if creation fails", async () => {
        const encryptedCipher = Symbol();
        userInterfaceSession.confirmNewCredential.mockResolvedValue({
          cipherId: existingCipher.id,
          userVerified: false,
        });
        cipherService.encrypt.mockResolvedValue(encryptedCipher as unknown as Cipher);
        cipherService.updateWithServer.mockRejectedValue(new Error("Internal error"));

        const result = async () => await authenticator.makeCredential(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Unknown);
      });
    });

    describe(`attestation of new credential`, () => {
      const cipherId = "75280e7e-a72e-4d6c-bf1e-d37238352f9b";
      const credentialId = "52217b91-73f1-4fea-b3f2-54a7959fd5aa";
      const credentialIdBytes = new Uint8Array([
        0x52, 0x21, 0x7b, 0x91, 0x73, 0xf1, 0x4f, 0xea, 0xb3, 0xf2, 0x54, 0xa7, 0x95, 0x9f, 0xd5,
        0xaa,
      ]);
      let params: Fido2AuthenticatorMakeCredentialsParams;

      beforeEach(async () => {
        const cipher = createCipherView({ id: cipherId, type: CipherType.Login });
        params = await createParams();
        userInterfaceSession.confirmNewCredential.mockResolvedValue({
          cipherId,
          userVerified: false,
        });
        cipherService.get.mockImplementation(async (cipherId) =>
          cipherId === cipher.id ? ({ decrypt: () => cipher } as any) : undefined,
        );
        cipherService.getAllDecrypted.mockResolvedValue([await cipher]);
        cipherService.encrypt.mockImplementation(async (cipher) => {
          cipher.login.fido2Credentials[0].credentialId = credentialId; // Replace id for testability
          return {} as any;
        });
        cipherService.createWithServer.mockImplementation(async (cipher) => {
          cipher.id = cipherId;
          return cipher;
        });
        cipherService.updateWithServer.mockImplementation(async (cipher) => {
          cipher.id = cipherId;
          return cipher;
        });
      });

      it("should return attestation object", async () => {
        const result = await authenticator.makeCredential(params, windowReference);

        const attestationObject = CBOR.decode(
          Fido2Utils.bufferSourceToUint8Array(result.attestationObject).buffer,
        );

        const encAuthData: Uint8Array = attestationObject.authData;
        const rpIdHash = encAuthData.slice(0, 32);
        const flags = encAuthData.slice(32, 33);
        const counter = encAuthData.slice(33, 37);
        const aaguid = encAuthData.slice(37, 53);
        const credentialIdLength = encAuthData.slice(53, 55);
        const credentialId = encAuthData.slice(55, 71);
        // Unsure how to test public key
        // const publicKey = encAuthData.slice(87);

        expect(encAuthData.length).toBe(71 + 77);
        expect(attestationObject.fmt).toBe("none");
        expect(attestationObject.attStmt).toEqual({});
        expect(rpIdHash).toEqual(
          new Uint8Array([
            0x22, 0x6b, 0xb3, 0x92, 0x02, 0xff, 0xf9, 0x22, 0xdc, 0x74, 0x05, 0xcd, 0x28, 0xa8,
            0x34, 0x5a, 0xc4, 0xf2, 0x64, 0x51, 0xd7, 0x3d, 0x0b, 0x40, 0xef, 0xf3, 0x1d, 0xc1,
            0xd0, 0x5c, 0x3d, 0xc3,
          ]),
        );
        expect(flags).toEqual(new Uint8Array([0b01011001])); // UP = true, AT = true, BE = true, BS = true
        expect(counter).toEqual(new Uint8Array([0, 0, 0, 0])); // 0 because of new counter
        expect(aaguid).toEqual(AAGUID);
        expect(credentialIdLength).toEqual(new Uint8Array([0, 16])); // 16 bytes because we're using GUIDs
        expect(credentialId).toEqual(credentialIdBytes);
      });
    });

    async function createParams(
      params: Partial<Fido2AuthenticatorMakeCredentialsParams> = {},
    ): Promise<Fido2AuthenticatorMakeCredentialsParams> {
      return {
        hash: params.hash ?? (await createClientDataHash()),
        rpEntity: params.rpEntity ?? {
          name: "Bitwarden",
          id: RpId,
        },
        userEntity: params.userEntity ?? {
          id: randomBytes(64),
          name: "jane.doe@bitwarden.com",
          displayName: "Jane Doe",
          icon: " data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAOhJREFUeNpiFI+9E8DAwDAfiAUYSAMfgDiQBVmzlSYnUTqPXf/OANWzngVZ87pKKaIMCGp/BjeEhRjFMKAjx8bQFC2CIs9CpHNxAiYGCsEQM4Cfiwm3AY9f/yZogIcRN4ZahAFv/jAcu4E7xMNtecEYpAakFqsX8me9Yvj07R+G5jR3foaJqWJgOZAaZMAIzAv/kQV05NgZ5hdIMMiKQJIIyEYrDU6wrYkTXjBcefQTvwGwwCoJFGJIBdoMArN3fmToWf+O4SMW14EMeI8rJ8Jcgexn9BwJCoNEaNbEACCN+DSDsjNAgAEAri9Zii/uDMsAAAAASUVORK5CYII=",
        },
        credTypesAndPubKeyAlgs: params.credTypesAndPubKeyAlgs ?? [
          {
            alg: -7, // ES256
            type: "public-key",
          },
        ],
        excludeCredentialDescriptorList: params.excludeCredentialDescriptorList ?? [
          {
            id: randomBytes(16),
            transports: ["internal"],
            type: "public-key",
          },
        ],
        requireResidentKey: params.requireResidentKey ?? false,
        requireUserVerification: params.requireUserVerification ?? false,
        fallbackSupported: params.fallbackSupported ?? false,
        extensions: params.extensions ?? {
          appid: undefined,
          appidExclude: undefined,
          credProps: undefined,
          uvm: false as boolean,
        },
      };
    }

    type InvalidParams = Awaited<ReturnType<typeof createInvalidParams>>;
    async function createInvalidParams() {
      return {
        unsupportedAlgorithm: await createParams({
          credTypesAndPubKeyAlgs: [{ alg: 9001, type: "public-key" }],
        }),
        invalidRk: await createParams({ requireResidentKey: "invalid-value" as any }),
        invalidUv: await createParams({
          requireUserVerification: "invalid-value" as any,
        }),
      };
    }
  });

  describe("getAssertion", () => {
    let invalidParams!: InvalidParams;

    beforeEach(async () => {
      invalidParams = await createInvalidParams();
    });

    describe("invalid input parameters", () => {
      it("should throw error when requireUserVerification has invalid value", async () => {
        const result = async () =>
          await authenticator.getAssertion(invalidParams.invalidUv, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Unknown);
      });

      /**
       * Spec: If requireUserVerification is true and the authenticator cannot perform user verification, return an error code equivalent to "ConstraintError" and terminate the operation.
       * Deviation: User verification is checked before checking for excluded credentials
       **/
      /** NOTE: This test should only be activated if we disable support for user verification */
      it.skip("should throw error if requireUserVerification is set to true", async () => {
        const params = await createParams({ requireUserVerification: true });

        const result = async () => await authenticator.getAssertion(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Constraint);
      });
    });

    describe("vault is missing non-discoverable credential", () => {
      let credentialId: string;
      let params: Fido2AuthenticatorGetAssertionParams;

      beforeEach(async () => {
        credentialId = Utils.newGuid();
        params = await createParams({
          allowCredentialDescriptorList: [
            { id: parseCredentialId(credentialId), type: "public-key" },
          ],
          rpId: RpId,
        });
      });

      /**
       * Spec: If credentialOptions is now empty, return an error code equivalent to "NotAllowedError" and terminate the operation.
       * Deviation: We do not throw error but instead inform the user and allow the user to fallback to browser implementation.
       **/
      it("should inform user if no credential exists when fallback is not supported", async () => {
        params.fallbackSupported = false;
        cipherService.getAllDecrypted.mockResolvedValue([]);
        userInterfaceSession.informCredentialNotFound.mockResolvedValue();

        try {
          await authenticator.getAssertion(params, windowReference);
          // eslint-disable-next-line no-empty
        } catch {}

        expect(userInterfaceSession.informCredentialNotFound).toHaveBeenCalled();
      });

      it("should inform user if credential exists but rpId does not match", async () => {
        const cipher = await createCipherView({ type: CipherType.Login });
        cipher.login.fido2Credentials[0].credentialId = credentialId;
        cipher.login.fido2Credentials[0].rpId = "mismatch-rpid";
        cipherService.getAllDecrypted.mockResolvedValue([cipher]);
        userInterfaceSession.informCredentialNotFound.mockResolvedValue();

        try {
          await authenticator.getAssertion(params, windowReference);
          // eslint-disable-next-line no-empty
        } catch {}

        expect(userInterfaceSession.informCredentialNotFound).toHaveBeenCalled();
      });
    });

    describe("vault is missing discoverable credential", () => {
      let params: Fido2AuthenticatorGetAssertionParams;

      beforeEach(async () => {
        params = await createParams({
          allowCredentialDescriptorList: [],
          rpId: RpId,
        });
        cipherService.getAllDecrypted.mockResolvedValue([]);
      });

      /** Spec: If credentialOptions is now empty, return an error code equivalent to "NotAllowedError" and terminate the operation. */
      it("should throw error", async () => {
        const result = async () => await authenticator.getAssertion(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.NotAllowed);
      });
    });

    describe("vault contains credential", () => {
      let credentialIds: string[];
      let ciphers: CipherView[];
      let params: Fido2AuthenticatorGetAssertionParams;

      beforeEach(async () => {
        credentialIds = [Utils.newGuid(), "b64.Lb5SVTumSV6gYJpeWh3laA"];
        ciphers = [
          await createCipherView(
            { type: CipherType.Login },
            { credentialId: credentialIds[0], rpId: RpId, discoverable: false },
          ),
          await createCipherView(
            { type: CipherType.Login },
            { credentialId: credentialIds[1], rpId: RpId, discoverable: true },
          ),
        ];
        params = await createParams({
          allowCredentialDescriptorList: credentialIds.map((credentialId) => ({
            id: parseCredentialId(credentialId),
            type: "public-key",
          })),
          rpId: RpId,
        });
        cipherService.getAllDecrypted.mockResolvedValue(ciphers);
      });

      it("should ask for all credentials in list when `params` contains allowedCredentials list", async () => {
        userInterfaceSession.pickCredential.mockResolvedValue({
          cipherId: ciphers[0].id,
          userVerified: false,
        });

        await authenticator.getAssertion(params, windowReference);

        expect(userInterfaceSession.pickCredential).toHaveBeenCalledWith({
          cipherIds: ciphers.map((c) => c.id),
          userVerification: false,
          masterPasswordRepromptRequired: false,
        });
      });

      it("should only ask for discoverable credentials matched by rpId when params does not contains allowedCredentials list", async () => {
        params.allowCredentialDescriptorList = undefined;
        const discoverableCiphers = ciphers.filter((c) => c.login.fido2Credentials[0].discoverable);
        userInterfaceSession.pickCredential.mockResolvedValue({
          cipherId: discoverableCiphers[0].id,
          userVerified: false,
        });

        await authenticator.getAssertion(params, windowReference);

        expect(userInterfaceSession.pickCredential).toHaveBeenCalledWith({
          cipherIds: [discoverableCiphers[0].id],
          userVerification: false,
          masterPasswordRepromptRequired: false,
        });
      });

      for (const userVerification of [true, false]) {
        /** Spec: Prompt the user to select a public key credential source selectedCredential from credentialOptions. */
        it(`should request confirmation from user when user verification is ${userVerification}`, async () => {
          params.requireUserVerification = userVerification;
          userInterfaceSession.pickCredential.mockResolvedValue({
            cipherId: ciphers[0].id,
            userVerified: userVerification,
          });

          await authenticator.getAssertion(params, windowReference);

          expect(userInterfaceSession.pickCredential).toHaveBeenCalledWith({
            cipherIds: ciphers.map((c) => c.id),
            userVerification,
            masterPasswordRepromptRequired: false,
          });
        });
      }

      /** Spec: If the user does not consent, return an error code equivalent to "NotAllowedError" and terminate the operation. */
      it("should throw error", async () => {
        userInterfaceSession.pickCredential.mockResolvedValue({
          cipherId: undefined,
          userVerified: false,
        });

        const result = async () => await authenticator.getAssertion(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.NotAllowed);
      });

      it("should throw error if user verification fails and cipher requires reprompt", async () => {
        ciphers[0].reprompt = CipherRepromptType.Password;
        userInterfaceSession.pickCredential.mockResolvedValue({
          cipherId: ciphers[0].id,
          userVerified: false,
        });

        const result = async () => await authenticator.getAssertion(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.NotAllowed);
      });
    });

    describe("assertion of credential", () => {
      let keyPair: CryptoKeyPair;
      let credentialIds: string[];
      let selectedCredentialId: string;
      let ciphers: CipherView[];
      let fido2Credentials: Fido2CredentialView[];
      let params: Fido2AuthenticatorGetAssertionParams;

      const init = async () => {
        keyPair = await createKeyPair();
        credentialIds = [Utils.newGuid(), Utils.newGuid()];
        const keyValue = Fido2Utils.bufferToString(
          await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
        );
        ciphers = credentialIds.map((id) =>
          createCipherView(
            { type: CipherType.Login },
            { credentialId: id, rpId: RpId, counter: 9000, keyValue },
          ),
        );
        fido2Credentials = ciphers.map((c) => c.login.fido2Credentials[0]);
        selectedCredentialId = credentialIds[0];
        params = await createParams({
          allowCredentialDescriptorList: credentialIds.map((credentialId) => ({
            id: parseCredentialId(credentialId),
            type: "public-key",
          })),
          rpId: RpId,
        });
        cipherService.getAllDecrypted.mockResolvedValue(ciphers);
        userInterfaceSession.pickCredential.mockResolvedValue({
          cipherId: ciphers[0].id,
          userVerified: false,
        });
      };
      beforeEach(init);

      /** Spec: Increment the credential associated signature counter */
      it("should increment counter and save to server when stored counter is larger than zero", async () => {
        const encrypted = Symbol();
        cipherService.encrypt.mockResolvedValue(encrypted as any);
        ciphers[0].login.fido2Credentials[0].counter = 9000;

        await authenticator.getAssertion(params, windowReference);

        expect(cipherService.updateWithServer).toHaveBeenCalledWith(encrypted);
        expect(cipherService.encrypt).toHaveBeenCalledWith(
          expect.objectContaining({
            id: ciphers[0].id,
            login: expect.objectContaining({
              fido2Credentials: [
                expect.objectContaining({
                  counter: 9001,
                }),
              ],
            }),
          }),
          "testId",
        );
      });

      /** Spec: Authenticators that do not implement a signature counter leave the signCount in the authenticator data constant at zero. */
      it("should not save to server when stored counter is zero", async () => {
        const encrypted = Symbol();
        cipherService.encrypt.mockResolvedValue(encrypted as any);
        ciphers[0].login.fido2Credentials[0].counter = 0;

        await authenticator.getAssertion(params, windowReference);

        expect(cipherService.updateWithServer).not.toHaveBeenCalled();
      });

      it("should return an assertion result", async () => {
        const result = await authenticator.getAssertion(params, windowReference);

        const encAuthData = result.authenticatorData;
        const rpIdHash = encAuthData.slice(0, 32);
        const flags = encAuthData.slice(32, 33);
        const counter = encAuthData.slice(33, 37);

        expect(result.selectedCredential.id).toEqual(parseCredentialId(selectedCredentialId));
        expect(result.selectedCredential.userHandle).toEqual(
          Fido2Utils.stringToBuffer(fido2Credentials[0].userHandle),
        );
        expect(rpIdHash).toEqual(
          new Uint8Array([
            0x22, 0x6b, 0xb3, 0x92, 0x02, 0xff, 0xf9, 0x22, 0xdc, 0x74, 0x05, 0xcd, 0x28, 0xa8,
            0x34, 0x5a, 0xc4, 0xf2, 0x64, 0x51, 0xd7, 0x3d, 0x0b, 0x40, 0xef, 0xf3, 0x1d, 0xc1,
            0xd0, 0x5c, 0x3d, 0xc3,
          ]),
        );
        expect(flags).toEqual(new Uint8Array([0b00011001])); // UP = true, BE = true, BS = true
        expect(counter).toEqual(new Uint8Array([0, 0, 0x23, 0x29])); // 9001 in hex

        // Verify signature
        // TODO: Cannot verify signature because it has been converted into DER format
        // const sigBase = new Uint8Array([
        //   ...result.authenticatorData,
        //   ...Fido2Utils.bufferSourceToUint8Array(params.hash),
        // ]);
        // const isValidSignature = await crypto.subtle.verify(
        //   { name: "ECDSA", hash: { name: "SHA-256" } },
        //   keyPair.publicKey,
        //   result.signature,
        //   sigBase
        // );
        // expect(isValidSignature).toBe(true);
      });

      it("should always generate unique signatures even if the input is the same", async () => {
        const signatures = new Set();

        for (let i = 0; i < 10; ++i) {
          await init(); // Reset inputs
          const result = await authenticator.getAssertion(params, windowReference);

          const counter = result.authenticatorData.slice(33, 37);
          expect(counter).toEqual(new Uint8Array([0, 0, 0x23, 0x29])); // double check that the counter doesn't change

          const signature = Fido2Utils.bufferToString(result.signature);
          if (signatures.has(signature)) {
            throw new Error("Found duplicate signature");
          }
          signatures.add(signature);
        }
      });

      /** Spec: If any error occurred while generating the assertion signature, return an error code equivalent to "UnknownError" and terminate the operation. */
      it("should throw unkown error if creation fails", async () => {
        cipherService.updateWithServer.mockRejectedValue(new Error("Internal error"));

        const result = async () => await authenticator.getAssertion(params, windowReference);

        await expect(result).rejects.toThrowError(Fido2AuthenticatorErrorCode.Unknown);
      });
    });

    describe("silentCredentialDiscovery", () => {
      it("returns the fido2Credentials of a cipher found by its rpId", async () => {
        const credentialId = Utils.newGuid();
        const cipher = await createCipherView(
          { type: CipherType.Login },
          { credentialId, rpId: RpId, discoverable: true },
        );
        const ciphers = [cipher];
        cipherService.getAllDecrypted.mockResolvedValue(ciphers);

        const result = await authenticator.silentCredentialDiscovery(RpId);

        expect(result).toEqual([cipher.login.fido2Credentials[0]]);
      });
    });

    async function createParams(
      params: Partial<Fido2AuthenticatorGetAssertionParams> = {},
    ): Promise<Fido2AuthenticatorGetAssertionParams> {
      return {
        rpId: params.rpId ?? RpId,
        hash: params.hash ?? (await createClientDataHash()),
        allowCredentialDescriptorList: params.allowCredentialDescriptorList ?? [],
        requireUserVerification: params.requireUserVerification ?? false,
        extensions: params.extensions ?? {},
        fallbackSupported: params.fallbackSupported ?? false,
      };
    }

    type InvalidParams = Awaited<ReturnType<typeof createInvalidParams>>;
    async function createInvalidParams() {
      const emptyRpId = await createParams();
      emptyRpId.rpId = undefined as any;
      return {
        emptyRpId,
        invalidUv: await createParams({
          requireUserVerification: "invalid-value" as any,
        }),
      };
    }
  });
});

function createCipherView(
  data: Partial<Omit<CipherView, "fido2Credential">> = {},
  fido2Credential: Partial<Fido2CredentialView> = {},
): CipherView {
  const cipher = new CipherView();
  cipher.id = data.id ?? Utils.newGuid();
  cipher.type = CipherType.Login;
  cipher.localData = {};

  const fido2CredentialView = new Fido2CredentialView();
  fido2CredentialView.credentialId = fido2Credential.credentialId ?? Utils.newGuid();
  fido2CredentialView.rpId = fido2Credential.rpId ?? RpId;
  fido2CredentialView.counter = fido2Credential.counter ?? 0;
  fido2CredentialView.userHandle =
    fido2Credential.userHandle ?? Fido2Utils.bufferToString(randomBytes(16));
  fido2CredentialView.userName = fido2Credential.userName;
  fido2CredentialView.keyAlgorithm = fido2Credential.keyAlgorithm ?? "ECDSA";
  fido2CredentialView.keyCurve = fido2Credential.keyCurve ?? "P-256";
  fido2CredentialView.discoverable = fido2Credential.discoverable ?? true;
  fido2CredentialView.keyValue =
    fido2CredentialView.keyValue ??
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgTC-7XDZipXbaVBlnkjlBgO16ZmqBZWejK2iYo6lV0dehRANCAASOcM2WduNq1DriRYN7ZekvZz-bRhA-qNT4v0fbp5suUFJyWmgOQ0bybZcLXHaerK5Ep1JiSrQcewtQNgLtry7f";

  cipher.login = new LoginView();
  cipher.login.fido2Credentials = [fido2CredentialView];

  return cipher;
}

async function createClientDataHash() {
  const encoder = new TextEncoder();
  const clientData = encoder.encode(
    JSON.stringify({
      type: "webauthn.create",
      challenge: Fido2Utils.bufferToString(randomBytes(16)),
      origin: RpId,
      crossOrigin: false,
    }),
  );
  return await crypto.subtle.digest({ name: "SHA-256" }, clientData);
}

/** This is a fake function that always returns the same byte sequence */
function randomBytes(length: number) {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}

async function createKeyPair() {
  return await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );
}
