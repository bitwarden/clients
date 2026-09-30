import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { ConfigService } from "../../abstractions/config/config.service";
import {
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import { LogService } from "../../abstractions/log.service";

import { Fido2AuthenticatorServiceSelector } from "./fido2-authenticator-service.selector";

const RP_ID = "bitwarden.com";
const WINDOW = {};

describe("Fido2AuthenticatorServiceSelector", () => {
  let configService: MockProxy<ConfigService>;
  let legacy: MockProxy<Fido2AuthenticatorService<unknown>>;
  let sdk: MockProxy<Fido2AuthenticatorService<unknown>>;
  let logService: MockProxy<LogService>;

  const makeCredentialParams = {} as Fido2AuthenticatorMakeCredentialsParams;
  const getAssertionParams = {} as Fido2AuthenticatorGetAssertionParams;

  beforeEach(() => {
    configService = mock<ConfigService>();
    legacy = mock<Fido2AuthenticatorService<unknown>>();
    sdk = mock<Fido2AuthenticatorService<unknown>>();
    logService = mock<LogService>();
  });

  function createSelector(flagEnabled: boolean) {
    configService.getFeatureFlag$.mockReturnValue(of(flagEnabled) as never);
    return new Fido2AuthenticatorServiceSelector<unknown>(configService, legacy, sdk, logService);
  }

  it("reads the PM-8313 flag", () => {
    createSelector(false);

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.PM8313_Fido2OperationsToSdk,
    );
  });

  describe("with the flag off", () => {
    it("routes every operation to the TypeScript authenticator", async () => {
      const selector = createSelector(false);
      const abortController = new AbortController();

      await selector.makeCredential(makeCredentialParams, WINDOW, abortController);
      await selector.getAssertion(getAssertionParams, WINDOW, abortController);
      await selector.silentCredentialDiscovery(RP_ID);

      expect(legacy.makeCredential).toHaveBeenCalledWith(
        makeCredentialParams,
        WINDOW,
        abortController,
      );
      expect(legacy.getAssertion).toHaveBeenCalledWith(getAssertionParams, WINDOW, abortController);
      expect(legacy.silentCredentialDiscovery).toHaveBeenCalledWith(RP_ID);
      expect(sdk.makeCredential).not.toHaveBeenCalled();
      expect(sdk.getAssertion).not.toHaveBeenCalled();
      expect(sdk.silentCredentialDiscovery).not.toHaveBeenCalled();
    });

    it("logs that the TypeScript implementation is active", async () => {
      await createSelector(false).makeCredential(makeCredentialParams, WINDOW);

      expect(logService.info).toHaveBeenCalledWith(expect.stringMatching(/disabled.*TypeScript/));
    });
  });

  describe("with the flag on", () => {
    it("routes every operation to the SDK authenticator", async () => {
      const selector = createSelector(true);
      const abortController = new AbortController();

      await selector.makeCredential(makeCredentialParams, WINDOW, abortController);
      await selector.getAssertion(getAssertionParams, WINDOW, abortController);
      await selector.silentCredentialDiscovery(RP_ID);

      expect(sdk.makeCredential).toHaveBeenCalledWith(
        makeCredentialParams,
        WINDOW,
        abortController,
      );
      expect(sdk.getAssertion).toHaveBeenCalledWith(getAssertionParams, WINDOW, abortController);
      expect(sdk.silentCredentialDiscovery).toHaveBeenCalledWith(RP_ID);
      expect(legacy.makeCredential).not.toHaveBeenCalled();
      expect(legacy.getAssertion).not.toHaveBeenCalled();
      expect(legacy.silentCredentialDiscovery).not.toHaveBeenCalled();
    });

    it("logs that the SDK implementation is active", async () => {
      await createSelector(true).getAssertion(getAssertionParams, WINDOW);

      expect(logService.info).toHaveBeenCalledWith(expect.stringMatching(/enabled.*SDK/));
    });

    it.each([
      ["makeCredential", () => sdk.makeCredential, () => legacy.makeCredential],
      ["getAssertion", () => sdk.getAssertion, () => legacy.getAssertion],
    ] as const)(
      "propagates a %s failure instead of retrying through TypeScript",
      async (method, sdkMethod, legacyMethod) => {
        sdkMethod().mockRejectedValue(new Error("sdk exploded"));
        const selector = createSelector(true);

        const call =
          method === "makeCredential"
            ? selector.makeCredential(makeCredentialParams, WINDOW)
            : selector.getAssertion(getAssertionParams, WINDOW);

        await expect(call).rejects.toThrow(/sdk exploded/);
        expect(legacyMethod()).not.toHaveBeenCalled();
      },
    );

    it("logs and falls back to TypeScript when silent discovery fails", async () => {
      const failure = new Error("discovery exploded");
      sdk.silentCredentialDiscovery.mockRejectedValue(failure);
      const fromTypeScript = [new Fido2CredentialView()];
      legacy.silentCredentialDiscovery.mockResolvedValue(fromTypeScript);

      await expect(createSelector(true).silentCredentialDiscovery(RP_ID)).resolves.toBe(
        fromTypeScript,
      );
      expect(logService.error).toHaveBeenCalledWith(expect.any(String), failure);
      expect(legacy.silentCredentialDiscovery).toHaveBeenCalledWith(RP_ID);
    });
  });
});
