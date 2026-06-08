import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { FakeActiveUserAccessor, FakeStateProvider } from "@bitwarden/state-test-utils";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkResponseModel,
} from "../models/responses/organization-invite-link.response";
import { ORGANIZATION_INVITE_LINK_KEY } from "../state/organization-invite-link-state";

import { DefaultOrganizationInviteLinkService } from "./default-organization-invite-link.service";

const mockUserId = "user-1" as UserId;
const mockOrgId = "12345678-1234-1234-1234-123456789012" as OrganizationId;

function makeResponseModel(
  overrides: Partial<OrganizationInviteLinkResponseModel> = {},
): OrganizationInviteLinkResponseModel {
  const resp = mock<OrganizationInviteLinkResponseModel>();
  resp.id = "link-id";
  resp.code = "abc123";
  resp.allowedDomains = ["example.com"];
  resp.encryptedInviteKey = "sealed-envelope-base64" as any;
  resp.encryptedOrgKey = undefined;
  resp.organizationId = mockOrgId;
  resp.creationDate = "2024-01-01T00:00:00Z";
  return Object.assign(resp, overrides);
}

function makeInviteLink(overrides: Partial<OrganizationInviteLink> = {}): OrganizationInviteLink {
  const link = new OrganizationInviteLink(makeResponseModel());
  return Object.assign(link, overrides);
}

describe("DefaultOrganizationInviteLinkService", () => {
  let sut: DefaultOrganizationInviteLinkService;
  let apiService: MockProxy<OrganizationInviteLinkApiService>;
  let stateProvider: FakeStateProvider;
  let environmentService: MockProxy<EnvironmentService>;
  let sdkService: MockSdkService;
  let inviteLinkClient: { generate_invite_crypto_bundle: jest.Mock; unseal_invite_key: jest.Mock };

  beforeEach(() => {
    apiService = mock<OrganizationInviteLinkApiService>();
    environmentService = mock<EnvironmentService>();
    const mockEnvironment = mock<Environment>();
    mockEnvironment.getWebVaultUrl.mockReturnValue("https://vault.bitwarden.com");
    const environmentSubject = new BehaviorSubject<Environment>(mockEnvironment);
    Object.defineProperty(environmentService, "environment$", {
      get: () => environmentSubject.asObservable(),
      configurable: true,
    });

    const accessor = new FakeActiveUserAccessor(mockUserId);
    stateProvider = new FakeStateProvider(accessor);

    sdkService = new MockSdkService();
    const sdkClient = sdkService.simulate.userLogin(mockUserId);
    inviteLinkClient = {
      generate_invite_crypto_bundle: jest.fn().mockReturnValue({
        inviteKey: "sdkInviteKeyB64url",
        sealedInviteKeyEnvelope: "sealed-envelope-base64",
      }),
      unseal_invite_key: jest.fn().mockReturnValue("unwrapped=="),
    };
    (sdkClient as any).invite_link = jest.fn().mockReturnValue(inviteLinkClient);

    sut = new DefaultOrganizationInviteLinkService(
      apiService,
      stateProvider,
      environmentService,
      sdkService,
    );
  });

  describe("inviteLink$", () => {
    it("fetches from API when cache is empty", async () => {
      const response = makeResponseModel();
      apiService.get.mockResolvedValue(response);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(apiService.get).toHaveBeenCalledWith(mockOrgId);
      expect(value).toEqual(new OrganizationInviteLink(response));
    });

    it("returns undefined when API returns 404", async () => {
      const notFound = new ErrorResponse(null, 404);
      apiService.get.mockRejectedValue(notFound);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(value).toBeUndefined();
    });

    it("emits cached value without calling API again", async () => {
      const inviteLink = makeInviteLink();
      await sut.upsert(mockUserId, inviteLink);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(apiService.get).not.toHaveBeenCalled();
      expect(value).toEqual(inviteLink);
    });

    it("propagates non-404 API errors", async () => {
      const serverError = Object.assign(new ErrorResponse({}, 500), { statusCode: 500 });
      apiService.get.mockRejectedValue(serverError);

      await expect(firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId))).rejects.toMatchObject({
        statusCode: 500,
      });
    });
  });

  describe("upsert", () => {
    it("writes OrganizationInviteLink to state", async () => {
      const inviteLink = makeInviteLink();
      await sut.upsert(mockUserId, inviteLink);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({ [mockOrgId]: inviteLink });
    });
  });

  describe("delete", () => {
    it("calls API delete and clears local state", async () => {
      const inviteLink = makeInviteLink();
      await sut.upsert(mockUserId, inviteLink);
      apiService.delete.mockResolvedValue();

      await sut.delete(mockUserId, mockOrgId);

      expect(apiService.delete).toHaveBeenCalledWith(mockOrgId);

      // State should be cleared after delete
      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored?.[mockOrgId]).toBeUndefined();
    });
  });

  describe("createInviteLink", () => {
    it("generates sealed envelope via SDK, calls API, and caches result", async () => {
      const response = makeResponseModel({ code: "code1", allowedDomains: ["bitwarden.com"] });
      apiService.create.mockResolvedValue(response);

      await firstValueFrom(sut.createInviteLink(mockUserId, mockOrgId, ["bitwarden.com"]));

      expect(inviteLinkClient.generate_invite_crypto_bundle).toHaveBeenCalledWith(mockOrgId);
      expect(apiService.create).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["bitwarden.com"] }),
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({ [mockOrgId]: new OrganizationInviteLink(response) });
    });

    it("throws when no domains are provided", async () => {
      await expect(firstValueFrom(sut.createInviteLink(mockUserId, mockOrgId, []))).rejects.toThrow(
        "At least one allowed domain is required.",
      );
    });

    it("surfaces SDK errors from bundle generation", async () => {
      inviteLinkClient.generate_invite_crypto_bundle.mockImplementation(() => {
        throw new Error("sdk crypto failure");
      });

      await expect(
        firstValueFrom(sut.createInviteLink(mockUserId, mockOrgId, ["example.com"])),
      ).rejects.toThrow("sdk crypto failure");
    });
  });

  describe("updateInviteLink", () => {
    it("calls API update with new domains and caches result", async () => {
      const response = makeResponseModel({ allowedDomains: ["updated.com"] });
      apiService.update.mockResolvedValue(response);

      await sut.updateInviteLink(mockUserId, mockOrgId, ["updated.com"]);

      expect(apiService.update).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["updated.com"] }),
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({ [mockOrgId]: new OrganizationInviteLink(response) });
    });

    it("throws when no domains are provided", async () => {
      // The throw happens in OrganizationInviteLinkUpdateRequest constructor before the API call
      await expect(sut.updateInviteLink(mockUserId, mockOrgId, [])).rejects.toThrow(
        "At least one allowed domain is required.",
      );
    });
  });

  describe("refreshInviteLink", () => {
    it("generates new key, calls apiService.refresh, and caches state", async () => {
      const response = makeResponseModel({ code: "refreshed", allowedDomains: ["example.com"] });
      apiService.refresh.mockResolvedValue(response);

      await firstValueFrom(sut.refreshInviteLink(mockUserId, mockOrgId));

      expect(inviteLinkClient.generate_invite_crypto_bundle).toHaveBeenCalledWith(mockOrgId);
      expect(apiService.refresh).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({
          encryptedInviteKey: "sealed-envelope-base64",
        }),
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({ [mockOrgId]: new OrganizationInviteLink(response) });
    });

    it("surfaces SDK errors from bundle generation", async () => {
      inviteLinkClient.generate_invite_crypto_bundle.mockImplementation(() => {
        throw new Error("sdk crypto failure");
      });

      await expect(firstValueFrom(sut.refreshInviteLink(mockUserId, mockOrgId))).rejects.toThrow(
        "sdk crypto failure",
      );
    });
  });

  describe("reconstructUrl", () => {
    it("unseals invite key and builds URL from the provided invite link", async () => {
      const inviteLink = makeInviteLink({
        code: "reconstruct",
        encryptedInviteKey: "sealed-envelope-base64" as any,
      });

      const url = await firstValueFrom(sut.reconstructUrl(mockUserId, mockOrgId, inviteLink));

      expect(inviteLinkClient.unseal_invite_key).toHaveBeenCalledWith(
        mockOrgId,
        "sealed-envelope-base64",
      );
      expect(url).toBe("https://vault.bitwarden.com/#/join/reconstruct?key=unwrapped==");
    });
  });
});
