import { MockProxy, mock } from "jest-mock-extended";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordDetailsResponse,
} from "@bitwarden/admin-console/common";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationAuthRequestApiService } from "./organization-auth-request-api.service";
import { OrganizationAuthRequestUpdateRequest } from "./organization-auth-request-update.request";
import { OrganizationAuthRequestService } from "./organization-auth-request.service";
import { PendingAuthRequestView } from "./pending-auth-request.view";

describe("OrganizationAuthRequestService", () => {
  let organizationAuthRequestApiService: MockProxy<OrganizationAuthRequestApiService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationAuthRequestService: OrganizationAuthRequestService;

  beforeEach(() => {
    organizationAuthRequestApiService = mock<OrganizationAuthRequestApiService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    organizationAuthRequestService = new OrganizationAuthRequestService(
      organizationAuthRequestApiService,
      keyService,
      encryptService,
      organizationUserApiService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("listPendingRequests", () => {
    it("should return a list of pending auth requests", async () => {
      jest.spyOn(organizationAuthRequestApiService, "listPendingRequests");

      const organizationId = "organizationId";

      const pendingAuthRequest = new PendingAuthRequestView();
      pendingAuthRequest.id = "requestId1";
      pendingAuthRequest.userId = "userId1";
      pendingAuthRequest.organizationUserId = "userId1";
      pendingAuthRequest.email = "email1";
      pendingAuthRequest.publicKey = "publicKey1";
      pendingAuthRequest.requestDeviceIdentifier = "requestDeviceIdentifier1";
      pendingAuthRequest.requestDeviceType = "requestDeviceType1";
      pendingAuthRequest.requestIpAddress = "requestIpAddress1";
      pendingAuthRequest.creationDate = new Date();
      const mockPendingAuthRequests = [pendingAuthRequest];
      organizationAuthRequestApiService.listPendingRequests
        .calledWith(organizationId)
        .mockResolvedValue(mockPendingAuthRequests);

      const result = await organizationAuthRequestService.listPendingRequests(organizationId);

      expect(result).toHaveLength(1);
      expect(result).toEqual(mockPendingAuthRequests);
      expect(organizationAuthRequestApiService.listPendingRequests).toHaveBeenCalledWith(
        organizationId,
      );
    });

    it("should return an empty list", async () => {
      jest.spyOn(organizationAuthRequestApiService, "listPendingRequests");

      const invalidOrganizationId = "invalidOrganizationId";
      const result =
        await organizationAuthRequestService.listPendingRequests("invalidOrganizationId");

      expect(result).toBeUndefined();
      expect(organizationAuthRequestApiService.listPendingRequests).toHaveBeenCalledWith(
        invalidOrganizationId,
      );
    });
  });

  describe("listPendingRequestsWithDetails", () => {
    it("should retrieve the fingerprint phrase for each request and return the new result", async () => {
      jest.spyOn(organizationAuthRequestApiService, "listPendingRequests");

      const organizationId = "organizationId";

      const pendingAuthRequest = new PendingAuthRequestView();
      pendingAuthRequest.id = "requestId1";
      pendingAuthRequest.userId = "userId1";
      pendingAuthRequest.organizationUserId = "userId1";
      pendingAuthRequest.email = "email1";
      pendingAuthRequest.publicKey = "publicKey1";
      pendingAuthRequest.requestDeviceIdentifier = "requestDeviceIdentifier1";
      pendingAuthRequest.requestDeviceType = "requestDeviceType1";
      pendingAuthRequest.requestIpAddress = "requestIpAddress1";
      pendingAuthRequest.creationDate = new Date();
      const mockPendingAuthRequests = [pendingAuthRequest];
      organizationAuthRequestApiService.listPendingRequests
        .calledWith(organizationId)
        .mockResolvedValue(mockPendingAuthRequests);

      const fingerprintPhrase = ["fingerprint", "phrase"];
      keyService.getFingerprint
        .calledWith(pendingAuthRequest.email, expect.any(Uint8Array))
        .mockResolvedValue(fingerprintPhrase);

      const result =
        await organizationAuthRequestService.listPendingRequestsWithFingerprint(organizationId);

      expect(result).toHaveLength(1);
      expect(result).toEqual([
        { ...pendingAuthRequest, fingerprintPhrase: fingerprintPhrase.join("-") },
      ]);
      expect(organizationAuthRequestApiService.listPendingRequests).toHaveBeenCalledWith(
        organizationId,
      );
    });

    it("should return empty list if no results and not call keyService", async () => {
      jest.spyOn(organizationAuthRequestApiService, "listPendingRequests");

      const organizationId = "organizationId";

      organizationAuthRequestApiService.listPendingRequests
        .calledWith(organizationId)
        .mockResolvedValue([]);

      const result =
        await organizationAuthRequestService.listPendingRequestsWithFingerprint(organizationId);

      expect(result).toHaveLength(0);
      expect(keyService.getFingerprint).not.toHaveBeenCalled();
      expect(organizationAuthRequestApiService.listPendingRequests).toHaveBeenCalledWith(
        organizationId,
      );
    });
  });

  describe("denyPendingRequests", () => {
    it("should deny the specified pending auth requests", async () => {
      jest.spyOn(organizationAuthRequestApiService, "denyPendingRequests");

      await organizationAuthRequestService.denyPendingRequests(
        "organizationId",
        "requestId1",
        "requestId2",
      );

      expect(organizationAuthRequestApiService.denyPendingRequests).toHaveBeenCalledWith(
        "organizationId",
        "requestId1",
        "requestId2",
      );
    });
  });

  describe("approvePendingRequests", () => {
    it("should approve the specified pending auth requests", async () => {
      jest.spyOn(organizationAuthRequestApiService, "bulkUpdatePendingRequests");

      const organizationId = "organizationId";

      const organizationUserResetPasswordDetailsResponse = new ListResponse(
        {
          Data: [
            {
              organizationUserId: "organizationUserId1",
              resetPasswordKey: "resetPasswordKey",
              encryptedPrivateKey: "encryptedPrivateKey",
            },
          ],
        },
        OrganizationUserResetPasswordDetailsResponse,
      );

      organizationUserApiService.getManyOrganizationUserAccountRecoveryDetails.mockResolvedValueOnce(
        organizationUserResetPasswordDetailsResponse,
      );

      const encryptedUserKey = new EncString("encryptedUserKey");
      encryptService.decapsulateKeyUnsigned.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)),
      );
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(encryptedUserKey);

      const mockPendingAuthRequest = new PendingAuthRequestView();
      mockPendingAuthRequest.id = "requestId1";
      mockPendingAuthRequest.organizationUserId = "organizationUserId1";
      mockPendingAuthRequest.publicKey = "publicKey1";

      await organizationAuthRequestService.approvePendingRequests(organizationId, [
        mockPendingAuthRequest,
      ]);

      expect(organizationAuthRequestApiService.bulkUpdatePendingRequests).toHaveBeenCalledWith(
        organizationId,
        [
          new OrganizationAuthRequestUpdateRequest(
            "requestId1",
            true,
            encryptedUserKey.encryptedString,
          ),
        ],
      );
    });
  });

  describe("approvePendingRequest", () => {
    it("should approve the specified pending auth request", async () => {
      jest.spyOn(organizationAuthRequestApiService, "approvePendingRequest");

      const organizationId = "organizationId";

      const organizationUserResetPasswordDetailsResponse =
        new OrganizationUserResetPasswordDetailsResponse({
          resetPasswordKey: "resetPasswordKey",
          encryptedPrivateKey: "encryptedPrivateKey",
        });

      organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
        organizationUserResetPasswordDetailsResponse,
      );

      const encryptedUserKey = new EncString("encryptedUserKey");
      encryptService.decapsulateKeyUnsigned.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)),
      );
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(encryptedUserKey);

      const mockPendingAuthRequest = new PendingAuthRequestView();
      mockPendingAuthRequest.id = "requestId1";
      mockPendingAuthRequest.organizationUserId = "organizationUserId1";
      mockPendingAuthRequest.publicKey = "publicKey1";

      await organizationAuthRequestService.approvePendingRequest(
        organizationId,
        mockPendingAuthRequest,
      );

      expect(organizationAuthRequestApiService.approvePendingRequest).toHaveBeenCalledWith(
        organizationId,
        mockPendingAuthRequest.id,
        encryptedUserKey,
      );
    });
  });
});
