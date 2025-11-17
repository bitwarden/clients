import { mock } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LoginStrategyServiceAbstraction, WebAuthnLoginCredentials } from "@bitwarden/auth/common";

import { LogService } from "../../../platform/abstractions/log.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { PrfKey } from "../../../types/key";
import {
  NavigatorCredentialsService,
  PublicKeyCredential as CustomPublicKeyCredential,
  AuthenticatorAssertionResponse as CustomAuthenticatorAssertionResponse,
} from "../../abstractions/webauthn/navigator-credentials.service";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { AuthResult } from "../../models/domain/auth-result";
import { WebAuthnLoginCredentialAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion.view";

import { WebAuthnLoginAssertionResponseRequest } from "./request/webauthn-login-assertion-response.request";
import { CredentialAssertionOptionsResponse } from "./response/credential-assertion-options.response";
import { WebAuthnLoginService } from "./webauthn-login.service";

describe("WebAuthnLoginService", () => {
  let webAuthnLoginService: WebAuthnLoginService;

  const webAuthnLoginApiService = mock<WebAuthnLoginApiServiceAbstraction>();
  const loginStrategyService = mock<LoginStrategyServiceAbstraction>();
  const webAuthnLoginPrfKeyService = mock<WebAuthnLoginPrfKeyServiceAbstraction>();
  const navigatorCredentials = mock<CredentialsContainer>();
  const logService = mock<LogService>();
  const mockNavigatorCredentialsService = mock<NavigatorCredentialsService>();

  let originalPublicKeyCredential!: PublicKeyCredential | any;
  let originalAuthenticatorAssertionResponse!: AuthenticatorAssertionResponse | any;
  let originalNavigator!: Navigator;

  beforeAll(() => {
    // Save off the original classes so we can restore them after all tests are done if they exist
    originalPublicKeyCredential = global.PublicKeyCredential;
    originalAuthenticatorAssertionResponse = global.AuthenticatorAssertionResponse;

    // Save the original navigator
    originalNavigator = global.window.navigator;

    // Mock the window.navigator with mocked CredentialsContainer
    Object.defineProperty(global.window, "navigator", {
      value: {
        ...originalNavigator,
        credentials: navigatorCredentials,
      },
      configurable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore global after all tests are done
    global.PublicKeyCredential = originalPublicKeyCredential;
    global.AuthenticatorAssertionResponse = originalAuthenticatorAssertionResponse;

    // Restore the original navigator
    Object.defineProperty(global.window, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  function createWebAuthnLoginService(): WebAuthnLoginService {
    return new WebAuthnLoginService(
      webAuthnLoginApiService,
      loginStrategyService,
      webAuthnLoginPrfKeyService,
      mockNavigatorCredentialsService,
      logService,
    );
  }
  it("instantiates", () => {
    webAuthnLoginService = createWebAuthnLoginService();
    expect(webAuthnLoginService).not.toBeFalsy();
  });

  describe("getCredentialAssertionOptions()", () => {
    it("webAuthnLoginService returns WebAuthnLoginCredentialAssertionOptionsView when getCredentialAssertionOptions is called with the feature enabled", async () => {
      // Arrange
      const webAuthnLoginService = createWebAuthnLoginService();

      const challenge = "6CG3jqMCVASJVXySMi9KWw";
      const token = "BWWebAuthnLoginAssertionOptions_CfDJ_2KBN892w";
      const timeout = 60000;
      const rpId = "localhost";
      const allowCredentials = [] as PublicKeyCredentialDescriptor[];
      const userVerification = "required";
      const objectName = "webAuthnLoginAssertionOptions";

      const mockedCredentialAssertionOptionsServerResponse = {
        options: {
          challenge: challenge,
          timeout: timeout,
          rpId: rpId,
          allowCredentials: allowCredentials,
          userVerification: userVerification,
          status: "ok",
          errorMessage: "",
        },
        token: token,
        object: objectName,
      };

      const mockedCredentialAssertionOptionsResponse = new CredentialAssertionOptionsResponse(
        mockedCredentialAssertionOptionsServerResponse,
      );

      webAuthnLoginApiService.getCredentialAssertionOptions.mockResolvedValue(
        mockedCredentialAssertionOptionsResponse,
      );

      // Act
      const result = await webAuthnLoginService.getCredentialAssertionOptions();

      // Assert
      expect(result).toBeInstanceOf(WebAuthnLoginCredentialAssertionOptionsView);
    });
  });

  describe("assertCredential(...)", () => {
    it("should assert the credential and return WebAuthnLoginAssertionView on success", async () => {
      // Arrange
      const webAuthnLoginService = createWebAuthnLoginService();
      const credentialAssertionOptions = buildCredentialAssertionOptions();

      // Mock webAuthnUtils functions
      const expectedSaltHex = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const saltArrayBuffer = Utils.hexStringToArrayBuffer(expectedSaltHex);

      const publicKeyCredential = mockPublicKeyCredential;
      const prfResult: ArrayBuffer = publicKeyCredential.prf.buffer as ArrayBuffer;
      const prfKey = new SymmetricCryptoKey(new Uint8Array(prfResult)) as PrfKey;

      webAuthnLoginPrfKeyService.getLoginWithPrfSalt.mockResolvedValue(saltArrayBuffer);
      webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf.mockResolvedValue(prfKey);

      // Mock implementations
      mockNavigatorCredentialsService.get.mockResolvedValue(publicKeyCredential);

      // Act
      const result = await webAuthnLoginService.assertCredential(credentialAssertionOptions);

      // Assert

      expect(webAuthnLoginPrfKeyService.getLoginWithPrfSalt).toHaveBeenCalled();

      expect(mockNavigatorCredentialsService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.objectContaining({
            ...credentialAssertionOptions.options,
            extensions: expect.objectContaining({
              prf: expect.objectContaining({
                eval: expect.objectContaining({
                  first: saltArrayBuffer,
                }),
              }),
            }),
          }),
        }),
      );

      expect(webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf).toHaveBeenCalledWith(prfResult);

      expect(result).toBeInstanceOf(WebAuthnLoginCredentialAssertionView);
      expect(result.token).toEqual(credentialAssertionOptions.token);

      expect(result.deviceResponse).toBeInstanceOf(WebAuthnLoginAssertionResponseRequest);
      expect(result.deviceResponse.id).toEqual(publicKeyCredential.id);
      expect(result.deviceResponse.rawId).toEqual(
        Utils.fromBufferToUrlB64(publicKeyCredential.rawId.buffer as ArrayBuffer),
      );
      expect(result.deviceResponse.type).toEqual(publicKeyCredential.type);
      // extensions being empty could change in the future but for now it is expected
      expect(result.deviceResponse.extensions).toEqual({});
      // but it should never contain any PRF information
      expect("prf" in result.deviceResponse.extensions).toBe(false);

      expect(result.deviceResponse.response).toEqual({
        authenticatorData: Utils.fromBufferToUrlB64(
          publicKeyCredential.response.authenticatorData.buffer as ArrayBuffer,
        ),
        clientDataJSON: Utils.fromBufferToUrlB64(
          publicKeyCredential.response.clientDataJSON.buffer as ArrayBuffer,
        ),
        signature: Utils.fromBufferToUrlB64(
          publicKeyCredential.response.signature.buffer as ArrayBuffer,
        ),
        userHandle: Utils.fromBufferToUrlB64(
          publicKeyCredential.response.userHandle.buffer as ArrayBuffer,
        ),
      });

      expect(result.prfKey).toEqual(prfKey);
    });

    it("should return undefined on non-PublicKeyCredential browser response", async () => {
      // Arrange
      const webAuthnLoginService = createWebAuthnLoginService();
      const credentialAssertionOptions = buildCredentialAssertionOptions();

      // Mock the navigatorCredentials.get to return null
      mockNavigatorCredentialsService.get.mockResolvedValue(null);

      // Act
      const result = await webAuthnLoginService.assertCredential(credentialAssertionOptions);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should log an error and return undefined when navigatorCredentials.get throws an error", async () => {
      // Arrange
      const webAuthnLoginService = createWebAuthnLoginService();
      const credentialAssertionOptions = buildCredentialAssertionOptions();

      // Mock navigatorCredentials.get to throw an error
      const errorMessage = "Simulated error";
      mockNavigatorCredentialsService.get.mockRejectedValue(new Error(errorMessage));

      // Spy on logService.error
      const logServiceErrorSpy = jest.spyOn(logService, "error");

      // Act
      const result = await webAuthnLoginService.assertCredential(credentialAssertionOptions);

      // Assert
      expect(result).toBeUndefined();
      expect(logServiceErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("logIn(...)", () => {
    function buildWebAuthnLoginCredentialAssertionView(): WebAuthnLoginCredentialAssertionView {
      const publicKeyCredential = mockPublicKeyCredential;

      const deviceResponse = new WebAuthnLoginAssertionResponseRequest(publicKeyCredential);

      const prfKey = new SymmetricCryptoKey(randomBytes(32)) as PrfKey;

      return new WebAuthnLoginCredentialAssertionView("mockToken", deviceResponse, prfKey);
    }

    it("should accept an assertion with a signed challenge and use it to try and login", async () => {
      // Arrange
      const webAuthnLoginService = createWebAuthnLoginService();
      const assertion = buildWebAuthnLoginCredentialAssertionView();
      const mockAuthResult: AuthResult = new AuthResult();

      jest.spyOn(loginStrategyService, "logIn").mockResolvedValue(mockAuthResult);

      // Act
      const result = await webAuthnLoginService.logIn(assertion);

      // Assert
      expect(result).toEqual(mockAuthResult);

      const callArguments = loginStrategyService.logIn.mock.calls[0];
      expect(callArguments[0]).toBeInstanceOf(WebAuthnLoginCredentials);
    });
  });
});

// Test helpers
function randomBytes(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}

// AuthenticatorAssertionResponse && PublicKeyCredential are only available in secure contexts
// so we need to mock them and assign them to the global object to make them available
// for the tests
const mockAuthenticatorAssertionResponse: CustomAuthenticatorAssertionResponse = {
  clientDataJSON: randomBytes(32),
  authenticatorData: randomBytes(196),
  signature: randomBytes(72),
  userHandle: randomBytes(16),
};

const mockPublicKeyCredential: CustomPublicKeyCredential = {
  authenticatorAttachment: "cross-platform",
  id: "mockCredentialId",
  type: "public-key",
  rawId: randomBytes(32),
  response: mockAuthenticatorAssertionResponse,
  prf: randomBytes(32),
};

function buildCredentialAssertionOptions(): WebAuthnLoginCredentialAssertionOptionsView {
  // Mock credential assertion options
  const challenge = "6CG3jqMCVASJVXySMi9KWw";
  const token = "BWWebAuthnLoginAssertionOptions_CfDJ_2KBN892w";
  const timeout = 60000;
  const rpId = "localhost";
  const allowCredentials = [] as PublicKeyCredentialDescriptor[];
  const userVerification = "required";
  const objectName = "webAuthnLoginAssertionOptions";

  const credentialAssertionOptionsServerResponse = {
    options: {
      challenge: challenge,
      timeout: timeout,
      rpId: rpId,
      allowCredentials: allowCredentials,
      userVerification: userVerification,
      status: "ok",
      errorMessage: "",
    },
    token: token,
    object: objectName,
  };

  const credentialAssertionOptionsResponse = new CredentialAssertionOptionsResponse(
    credentialAssertionOptionsServerResponse,
  );

  return new WebAuthnLoginCredentialAssertionOptionsView(
    credentialAssertionOptionsResponse.options,
    credentialAssertionOptionsResponse.token,
  );
}
