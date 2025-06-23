import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { DomainSettingsService } from "../../../autofill/services/domain-settings.service";
import { Utils } from "../../../platform/misc/utils";
import { VaultSettingsService } from "../../../vault/abstractions/vault-settings/vault-settings.service";
import { ConfigService } from "../../abstractions/config/config.service";
import {
  ActiveRequest,
  Fido2ActiveRequestEvents,
  Fido2ActiveRequestManager,
  RequestResult,
} from "../../abstractions/fido2/fido2-active-request-manager.abstraction";
import {
  Fido2AuthenticatorError,
  Fido2AuthenticatorErrorCode,
  Fido2AuthenticatorGetAssertionResult,
  Fido2AuthenticatorMakeCredentialResult,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import {
  AssertCredentialParams,
  CreateCredentialParams,
  FallbackRequestedError,
} from "../../abstractions/fido2/fido2-client.service.abstraction";
import { TaskSchedulerService } from "../../scheduling/task-scheduler.service";

import * as DomainUtils from "./domain-utils";
import { Fido2AuthenticatorService } from "./fido2-authenticator.service";
import { Fido2ClientService } from "./fido2-client.service";
import { Fido2Utils } from "./fido2-utils";
import { guidToRawFormat } from "./guid-utils";

type ParentWindowReference = string;

const RpId = "bitwarden.com";
const Origin = "https://bitwarden.com";
const VaultUrl = "https://vault.bitwarden.com";

describe("FidoAuthenticatorService", () => {
  let authenticator!: MockProxy<Fido2AuthenticatorService<ParentWindowReference>>;
  let configService!: MockProxy<ConfigService>;
  let authService!: MockProxy<AuthService>;
  let vaultSettingsService: MockProxy<VaultSettingsService>;
  let domainSettingsService: MockProxy<DomainSettingsService>;
  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  let activeRequest!: MockProxy<ActiveRequest>;
  let requestManager!: MockProxy<Fido2ActiveRequestManager>;
  let client!: Fido2ClientService<ParentWindowReference>;
  let windowReference!: ParentWindowReference;
  let isValidRpId!: jest.SpyInstance;

  beforeEach(async () => {
    authenticator = mock<Fido2AuthenticatorService<ParentWindowReference>>();
    configService = mock<ConfigService>();
    authService = mock<AuthService>();
    vaultSettingsService = mock<VaultSettingsService>();
    domainSettingsService = mock<DomainSettingsService>();
    taskSchedulerService = mock<TaskSchedulerService>();
    activeRequest = mock<ActiveRequest>({
      subject: new BehaviorSubject<RequestResult>({
        type: Fido2ActiveRequestEvents.Continue,
        credentialId: "",
      }),
    });
    requestManager = mock<Fido2ActiveRequestManager>({
      getActiveRequest$: (tabId: number) => new BehaviorSubject(activeRequest),
      getActiveRequest: (tabId: number) => activeRequest,
    });

    isValidRpId = jest.spyOn(DomainUtils, "isValidRpId");

    client = new Fido2ClientService(
      authenticator,
      configService,
      authService,
      vaultSettingsService,
      domainSettingsService,
      taskSchedulerService,
      requestManager,
    );
    configService.serverConfig$ = of({ environment: { vault: VaultUrl } } as any);
    vaultSettingsService.enablePasskeys$ = of(true);
    domainSettingsService.neverDomains$ = of({});
    authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
    windowReference = Utils.newGuid();
  });

  afterEach(() => {
    isValidRpId.mockRestore();
  });

  describe("createCredential", () => {
    describe("Mapping params should handle variations in input formats", () => {
      it.each([
        [true, true],
        [false, false],
        ["false", false],
        ["", false],
        ["true", true],
      ])("requireResidentKey should handle %s as boolean %s", async (input, expected) => {
        const params = createParams({
          authenticatorSelection: { requireResidentKey: input as any },
          extensions: { credProps: true },
        });

        authenticator.makeCredential.mockResolvedValue(createAuthenticatorMakeResult());

        const result = await client.createCredential(params, windowReference);

        expect(result.extensions.credProps?.rk).toBe(expected);
      });
    });

    describe("input parameters validation", () => {
      // Spec: If sameOriginWithAncestors is false, return a "NotAllowedError" DOMException.
      it("should throw error if sameOriginWithAncestors is false", async () => {
        const params = createParams({ sameOriginWithAncestors: false });

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "NotAllowedError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      // Spec: If the length of options.user.id is not between 1 and 64 bytes (inclusive) then return a TypeError.
      it("should throw error if user.id is too small", async () => {
        const params = createParams({ user: { id: "", displayName: "displayName", name: "name" } });

        const result = async () => await client.createCredential(params, windowReference);

        await expect(result).rejects.toBeInstanceOf(TypeError);
      });

      // Spec: If the length of options.user.id is not between 1 and 64 bytes (inclusive) then return a TypeError.
      it("should throw error if user.id is too large", async () => {
        const params = createParams({
          user: {
            id: "YWJzb2x1dGVseS13YXktd2F5LXRvby1sYXJnZS1iYXNlNjQtZW5jb2RlZC11c2VyLWlkLWJpbmFyeS1zZXF1ZW5jZQ",
            displayName: "displayName",
            name: "name",
          },
        });

        const result = async () => await client.createCredential(params, windowReference);

        await expect(result).rejects.toBeInstanceOf(TypeError);
      });

      // Spec: If callerOrigin is an opaque origin, return a DOMException whose name is "NotAllowedError", and terminate this algorithm.
      // Not sure how to check this, or if it matters.
      it.todo("should throw error if origin is an opaque origin");

      // Spec: Let effectiveDomain be the callerOrigin’s effective domain. If effective domain is not a valid domain, then return a DOMException whose name is "SecurityError" and terminate this algorithm.
      it("should throw error if origin is not a valid domain name", async () => {
        const params = createParams({
          origin: "invalid-domain-name",
        });

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      // Spec: If options.rp.id is not a registrable domain suffix of and is not equal to effectiveDomain, return a DOMException whose name is "SecurityError", and terminate this algorithm.
      // This is actually checked by `isValidRpId` function, but we'll test it here as well
      it("should throw error if rp.id is not valid for this origin", async () => {
        const params = createParams({
          origin: "https://passwordless.dev",
          rp: { id: "bitwarden.com", name: "Bitwarden" },
        });

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      // Sanity check to make sure that we use `isValidRpId` to validate the rp.id
      it("should throw if isValidRpId returns false", async () => {
        const params = createParams();
        authenticator.makeCredential.mockResolvedValue(createAuthenticatorMakeResult());
        // `params` actually has a valid rp.id, but we're mocking the function to return false
        isValidRpId.mockReturnValue(false);

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      it("should fallback if origin hostname is found in neverDomains", async () => {
        const params = createParams({
          origin: "https://bitwarden.com",
          rp: { id: "bitwarden.com", name: "Bitwarden" },
        });
        domainSettingsService.neverDomains$ = of({ "bitwarden.com": null });

        const result = async () => await client.createCredential(params, windowReference);

        await expect(result).rejects.toThrow(FallbackRequestedError);
      });

      it("should throw error if origin is not an https domain", async () => {
        const params = createParams({
          origin: "http://passwordless.dev",
          rp: { id: "bitwarden.com", name: "Bitwarden" },
        });

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      it("should not throw error if localhost is http", async () => {
        const params = createParams({
          origin: "http://localhost",
          rp: { id: undefined, name: "localhost" },
        });
        authenticator.makeCredential.mockResolvedValue(createAuthenticatorMakeResult());

        await client.createCredential(params, windowReference);
      });

      // Spec: If credTypesAndPubKeyAlgs is empty, return a DOMException whose name is "NotSupportedError", and terminate this algorithm.
      it("should throw error if no support key algorithms were found", async () => {
        const params = createParams({
          pubKeyCredParams: [
            { alg: -9001, type: "public-key" },
            { alg: -7, type: "not-supported" as any },
          ],
        });

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "NotSupportedError" });
        await rejects.toBeInstanceOf(DOMException);
      });
    });

    describe("aborting", () => {
      // Spec: If the options.signal is present and its aborted flag is set to true, return a DOMException whose name is "AbortError" and terminate this algorithm.
      it("should throw error if aborting using abort controller", async () => {
        const params = createParams({});
        const abortController = new AbortController();
        abortController.abort();

        const result = async () =>
          await client.createCredential(params, windowReference, abortController);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "AbortError" });
        await rejects.toBeInstanceOf(DOMException);
      });
    });

    describe("creating a new credential", () => {
      it("should call authenticator.makeCredential", async () => {
        const params = createParams({
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
        });
        authenticator.makeCredential.mockResolvedValue(createAuthenticatorMakeResult());

        await client.createCredential(params, windowReference);

        expect(authenticator.makeCredential).toHaveBeenCalledWith(
          expect.objectContaining({
            requireResidentKey: true,
            requireUserVerification: true,
            rpEntity: expect.objectContaining({
              id: RpId,
            }),
            userEntity: expect.objectContaining({
              displayName: params.user.displayName,
            }),
          }),
          windowReference,
          expect.anything(),
        );
      });

      it("should return credProps.rk = true when creating a discoverable credential", async () => {
        const params = createParams({
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
          extensions: { credProps: true },
        });
        authenticator.makeCredential.mockResolvedValue(createAuthenticatorMakeResult());

        const result = await client.createCredential(params, windowReference);

        expect(result.extensions.credProps?.rk).toBe(true);
      });

      it("should return credProps.rk = false when creating a non-discoverable credential", async () => {
        const params = createParams({
          authenticatorSelection: { residentKey: "discouraged", userVerification: "required" },
          extensions: { credProps: true },
        });
        authenticator.makeCredential.mockResolvedValue(createAuthenticatorMakeResult());

        const result = await client.createCredential(params, windowReference);

        expect(result.extensions.credProps?.rk).toBe(false);
      });

      it("should return credProps = undefiend when the extension is not requested", async () => {
        const params = createParams({
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
          extensions: {},
        });
        authenticator.makeCredential.mockResolvedValue(createAuthenticatorMakeResult());

        const result = await client.createCredential(params, windowReference);

        expect(result.extensions.credProps).toBeUndefined();
      });

      // Spec: If any authenticator returns an error status equivalent to "InvalidStateError", Return a DOMException whose name is "InvalidStateError" and terminate this algorithm.
      it("should throw error if authenticator throws InvalidState", async () => {
        const params = createParams();
        authenticator.makeCredential.mockRejectedValue(
          new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.InvalidState),
        );

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "InvalidStateError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      // This keeps sensetive information form leaking
      it("should throw NotAllowedError if authenticator throws unknown error", async () => {
        const params = createParams();
        authenticator.makeCredential.mockRejectedValue(new Error("unknown error"));

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "NotAllowedError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      it("should throw FallbackRequestedError if passkeys state is not enabled", async () => {
        const params = createParams();
        vaultSettingsService.enablePasskeys$ = of(false);

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toThrow(FallbackRequestedError);
      });

      it("should throw FallbackRequestedError if user is logged out", async () => {
        const params = createParams();
        authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toThrow(FallbackRequestedError);
      });

      it("should throw FallbackRequestedError if origin equals the bitwarden vault", async () => {
        const params = createParams({ origin: VaultUrl });

        const result = async () => await client.createCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toThrow(FallbackRequestedError);
      });
    });

    function createParams(params: Partial<CreateCredentialParams> = {}): CreateCredentialParams {
      return {
        origin: params.origin ?? "https://bitwarden.com",
        sameOriginWithAncestors: params.sameOriginWithAncestors ?? true,
        attestation: params.attestation,
        authenticatorSelection: params.authenticatorSelection,
        challenge: params.challenge ?? "MzItYnl0ZXMtYmFzZTY0LWVuY29kZS1jaGFsbGVuZ2U",
        excludeCredentials: params.excludeCredentials,
        extensions: params.extensions,
        pubKeyCredParams: params.pubKeyCredParams ?? [
          {
            alg: -7,
            type: "public-key",
          },
        ],
        rp: params.rp ?? {
          id: RpId,
          name: "Bitwarden",
        },
        user: params.user ?? {
          id: "YmFzZTY0LWVuY29kZWQtdXNlci1pZA",
          displayName: "User Name",
          name: "name",
        },
        fallbackSupported: params.fallbackSupported ?? false,
        timeout: params.timeout,
      };
    }

    function createAuthenticatorMakeResult(): Fido2AuthenticatorMakeCredentialResult {
      return {
        credentialId: guidToRawFormat(Utils.newGuid()),
        attestationObject: randomBytes(128),
        authData: randomBytes(64),
        publicKey: randomBytes(64),
        publicKeyAlgorithm: -7,
      };
    }
  });

  describe("assertCredential", () => {
    describe("invalid params", () => {
      // Spec: If callerOrigin is an opaque origin, return a DOMException whose name is "NotAllowedError", and terminate this algorithm.
      // Not sure how to check this, or if it matters.
      it.todo("should throw error if origin is an opaque origin");

      // Spec: Let effectiveDomain be the callerOrigin’s effective domain. If effective domain is not a valid domain, then return a DOMException whose name is "SecurityError" and terminate this algorithm.
      it("should throw error if origin is not a valid domain name", async () => {
        const params = createParams({
          origin: "invalid-domain-name",
        });

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      // Spec: If options.rp.id is not a registrable domain suffix of and is not equal to effectiveDomain, return a DOMException whose name is "SecurityError", and terminate this algorithm.
      // This is actually checked by `isValidRpId` function, but we'll test it here as well
      it("should throw error if rp.id is not valid for this origin", async () => {
        const params = createParams({
          origin: "https://passwordless.dev",
          rpId: "bitwarden.com",
        });

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      // Sanity check to make sure that we use `isValidRpId` to validate the rp.id
      it("should throw if isValidRpId returns false", async () => {
        const params = createParams();
        authenticator.getAssertion.mockResolvedValue(createAuthenticatorAssertResult());
        // `params` actually has a valid rp.id, but we're mocking the function to return false
        isValidRpId.mockReturnValue(false);

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      it("should fallback if origin hostname is found in neverDomains", async () => {
        const params = createParams({
          origin: "https://bitwarden.com",
        });

        domainSettingsService.neverDomains$ = of({ "bitwarden.com": null });

        const result = async () => await client.assertCredential(params, windowReference);

        await expect(result).rejects.toThrow(FallbackRequestedError);
      });

      it("should throw error if origin is not an http domain", async () => {
        const params = createParams({
          origin: "http://passwordless.dev",
          rpId: "bitwarden.com",
        });

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "SecurityError" });
        await rejects.toBeInstanceOf(DOMException);
      });
    });

    describe("aborting", () => {
      // Spec: If the options.signal is present and its aborted flag is set to true, return a DOMException whose name is "AbortError" and terminate this algorithm.
      it("should throw error if aborting using abort controller", async () => {
        const params = createParams({});
        const abortController = new AbortController();
        abortController.abort();

        const result = async () =>
          await client.assertCredential(params, windowReference, abortController);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "AbortError" });
        await rejects.toBeInstanceOf(DOMException);
      });
    });

    describe("assert credential", () => {
      // Spec: If any authenticator returns an error status equivalent to "InvalidStateError", Return a DOMException whose name is "InvalidStateError" and terminate this algorithm.
      it("should throw error if authenticator throws InvalidState", async () => {
        const params = createParams();
        authenticator.getAssertion.mockRejectedValue(
          new Fido2AuthenticatorError(Fido2AuthenticatorErrorCode.InvalidState),
        );

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "InvalidStateError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      // This keeps sensetive information form leaking
      it("should throw NotAllowedError if authenticator throws unknown error", async () => {
        const params = createParams();
        authenticator.getAssertion.mockRejectedValue(new Error("unknown error"));

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toMatchObject({ name: "NotAllowedError" });
        await rejects.toBeInstanceOf(DOMException);
      });

      it("should throw FallbackRequestedError if passkeys state is not enabled", async () => {
        const params = createParams();
        vaultSettingsService.enablePasskeys$ = of(false);

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toThrow(FallbackRequestedError);
      });

      it("should throw FallbackRequestedError if user is logged out", async () => {
        const params = createParams();
        authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toThrow(FallbackRequestedError);
      });

      it("should throw FallbackRequestedError if origin equals the bitwarden vault", async () => {
        const params = createParams({ origin: VaultUrl });

        const result = async () => await client.assertCredential(params, windowReference);

        const rejects = expect(result).rejects;
        await rejects.toThrow(FallbackRequestedError);
      });
    });

    describe("assert non-discoverable credential", () => {
      it("should call authenticator.assertCredential", async () => {
        const allowedCredentialIds = [
          Fido2Utils.bufferToString(guidToRawFormat(Utils.newGuid())),
          Fido2Utils.bufferToString(guidToRawFormat(Utils.newGuid())),
          Fido2Utils.bufferToString(Utils.fromByteStringToArray("not-a-guid")),
        ];
        const params = createParams({
          userVerification: "required",
          allowedCredentialIds,
        });
        authenticator.getAssertion.mockResolvedValue(createAuthenticatorAssertResult());

        await client.assertCredential(params, windowReference);

        expect(authenticator.getAssertion).toHaveBeenCalledWith(
          expect.objectContaining({
            requireUserVerification: true,
            rpId: RpId,
            allowCredentialDescriptorList: [
              expect.objectContaining({
                id: Fido2Utils.stringToBuffer(allowedCredentialIds[0]),
              }),
              expect.objectContaining({
                id: Fido2Utils.stringToBuffer(allowedCredentialIds[1]),
              }),
              expect.objectContaining({
                id: Fido2Utils.stringToBuffer(allowedCredentialIds[2]),
              }),
            ],
          }),
          windowReference,
          expect.anything(),
        );
      });

      it("should not throw error if localhost is http", async () => {
        const params = createParams({
          origin: "http://localhost",
        });
        params.rpId = undefined;
        authenticator.getAssertion.mockResolvedValue(createAuthenticatorAssertResult());

        await client.assertCredential(params, windowReference);
      });
    });

    describe("assert discoverable credential", () => {
      it("should call authenticator.assertCredential", async () => {
        const params = createParams({
          userVerification: "required",
          allowedCredentialIds: [],
        });
        authenticator.getAssertion.mockResolvedValue(createAuthenticatorAssertResult());

        await client.assertCredential(params, windowReference);

        expect(authenticator.getAssertion).toHaveBeenCalledWith(
          expect.objectContaining({
            requireUserVerification: true,
            rpId: RpId,
            allowCredentialDescriptorList: [],
          }),
          windowReference,
          expect.anything(),
        );
      });
    });

    describe("assert mediated conditional ui credential", () => {
      const params = createParams({
        userVerification: "required",
        mediation: "conditional",
        allowedCredentialIds: [],
      });

      beforeEach(() => {
        requestManager.newActiveRequest.mockResolvedValue({
          type: Fido2ActiveRequestEvents.Continue,
          credentialId: crypto.randomUUID(),
        });
        authenticator.getAssertion.mockResolvedValue(createAuthenticatorAssertResult());
      });

      it("creates an active mediated conditional request", async () => {
        await client.assertCredential(params, windowReference);

        expect(requestManager.newActiveRequest).toHaveBeenCalled();
        expect(authenticator.getAssertion).toHaveBeenCalledWith(
          expect.objectContaining({
            assumeUserPresence: true,
            rpId: RpId,
          }),
          windowReference,
        );
      });

      it("restarts the mediated conditional request if a user aborts the request", async () => {
        authenticator.getAssertion.mockRejectedValueOnce(new Error());

        await client.assertCredential(params, windowReference);

        expect(authenticator.getAssertion).toHaveBeenCalledTimes(2);
      });

      it("restarts the mediated conditional request if a the abort controller aborts the request", async () => {
        const abortController = new AbortController();
        abortController.abort();
        authenticator.getAssertion.mockRejectedValueOnce(new DOMException("AbortError"));

        await client.assertCredential(params, windowReference);

        expect(authenticator.getAssertion).toHaveBeenCalledTimes(2);
      });
    });

    function createParams(params: Partial<AssertCredentialParams> = {}): AssertCredentialParams {
      return {
        allowedCredentialIds: params.allowedCredentialIds ?? [],
        challenge: params.challenge ?? Fido2Utils.bufferToString(randomBytes(16)),
        origin: params.origin ?? Origin,
        rpId: params.rpId ?? RpId,
        timeout: params.timeout,
        userVerification: params.userVerification,
        sameOriginWithAncestors: true,
        fallbackSupported: params.fallbackSupported ?? false,
        mediation: params.mediation,
      };
    }

    function createAuthenticatorAssertResult(): Fido2AuthenticatorGetAssertionResult {
      return {
        selectedCredential: {
          id: randomBytes(32),
          userHandle: randomBytes(32),
        },
        authenticatorData: randomBytes(64),
        signature: randomBytes(64),
      };
    }
  });
});

/** This is a fake function that always returns the same byte sequence */
function randomBytes(length: number) {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}
