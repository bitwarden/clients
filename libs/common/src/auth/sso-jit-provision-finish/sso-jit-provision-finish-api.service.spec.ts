import { mock, MockProxy } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../abstractions/api.service";
import { SetKeyConnectorKeyRequest } from "../../key-management/key-connector/models/set-key-connector-key.request";
import { KeysRequest } from "../../models/request/keys.request";
import { LogService } from "../../platform/abstractions/log.service";

import { SsoJitProvisionFinishApiService } from "./sso-jit-provision-finish-api.service";
import { SsoJitProvisionFinishSetKeyConnectorKeyRequest } from "./sso-jit-provision-finish-set-key-connector-key.request";

describe("SsoJitProvisionFinishApiService", () => {
  let apiService: MockProxy<ApiService>;
  let logService: MockProxy<LogService>;

  let sut: SsoJitProvisionFinishApiService;

  let keyConnectorKeys: SetKeyConnectorKeyRequest;

  function makeRequest(acceptOrganizationInvite: boolean) {
    return new SsoJitProvisionFinishSetKeyConnectorKeyRequest(
      keyConnectorKeys,
      acceptOrganizationInvite,
    );
  }

  beforeEach(() => {
    apiService = mock<ApiService>();
    logService = mock<LogService>();

    sut = new SsoJitProvisionFinishApiService(apiService, logService);

    keyConnectorKeys = new SetKeyConnectorKeyRequest(
      "keyConnectorKeyWrappedUserKey",
      new PBKDF2KdfConfig(600_000),
      "orgIdentifier",
      new KeysRequest("publicKey", "encryptedPrivateKey"),
    );
  });

  describe("postKeyConnector", () => {
    it.each([
      ["a direct invite", true],
      ["an open invite", false],
    ])(
      "should POST the request to /sso-jit-provision-finish/key-connector for %s (acceptOrganizationInvite: %s)",
      async (_, acceptOrganizationInvite) => {
        // Arrange
        const request = makeRequest(acceptOrganizationInvite);

        // Act
        await sut.postKeyConnector(request);

        // Assert
        expect(apiService.send).toHaveBeenCalledTimes(1);
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/sso-jit-provision-finish/key-connector",
          request,
          true,
          false,
        );
      },
    );

    it("should log and rethrow when the request fails", async () => {
      // Arrange
      const error = new Error("request failed");
      apiService.send.mockRejectedValue(error);

      // Act
      const promise = sut.postKeyConnector(makeRequest(true));

      // Assert
      await expect(promise).rejects.toThrow(error);
      expect(logService.error).toHaveBeenCalledWith(error);
    });
  });

  describe("SsoJitProvisionFinishSetKeyConnectorKeyRequest", () => {
    it("should serialize to the server request shape", () => {
      // Act
      const body = JSON.parse(JSON.stringify(makeRequest(false)));

      // Assert
      expect(body).toEqual({
        keyConnectorKeys: {
          key: "keyConnectorKeyWrappedUserKey",
          kdf: 0,
          kdfIterations: 600_000,
          orgIdentifier: "orgIdentifier",
          keys: { publicKey: "publicKey", encryptedPrivateKey: "encryptedPrivateKey" },
        },
        acceptOrganizationInvite: false,
      });
    });
  });
});
