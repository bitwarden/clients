import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  Invite,
  OrganizationInviteLink as SdkOrganizationInviteLink,
} from "@bitwarden/sdk-internal";
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
  resp.invite = "sealed-envelope-base64" as Invite;
  resp.supportsConfirmation = true;
  resp.organizationId = mockOrgId;
  resp.creationDate = "2024-01-01T00:00:00Z";
  return Object.assign(resp, overrides);
}

function makeInviteLink(overrides: Partial<OrganizationInviteLink> = {}): OrganizationInviteLink {
  const link = new OrganizationInviteLink(makeResponseModel());
  return Object.assign(link, overrides);
}

function makeSdkInviteLink(
  overrides: Partial<SdkOrganizationInviteLink> = {},
): SdkOrganizationInviteLink {
  return {
    id: "link-id",
    code: "sdk-code",
    organizationId: mockOrgId,
    allowedDomains: ["example.com"],
    invite: "sealed-envelope-base64" as Invite,
    supportsConfirmation: true,
    creationDate: "2024-01-01T00:00:00Z",
    ...overrides,
  } as SdkOrganizationInviteLink;
}

describe("DefaultOrganizationInviteLinkService", () => {
  let sut: DefaultOrganizationInviteLinkService;
  let apiService: MockProxy<OrganizationInviteLinkApiService>;
  let stateProvider: FakeStateProvider;
  let environmentService: MockProxy<EnvironmentService>;
  let sdkService: MockSdkService;
  let inviteLinkClient: {
    create_invite_link: jest.Mock;
    refresh_invite_link: jest.Mock;
    set_invite_confirmation: jest.Mock;
    get_invite_secret: jest.Mock;
  };

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
      create_invite_link: jest.fn().mockResolvedValue(makeSdkInviteLink()),
      refresh_invite_link: jest.fn().mockResolvedValue(makeSdkInviteLink()),
      set_invite_confirmation: jest.fn().mockResolvedValue(makeSdkInviteLink()),
      get_invite_secret: jest.fn().mockReturnValue("unwrapped=="),
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
    it("generates the invite link via SDK and caches the result", async () => {
      const sdkInviteLink = makeSdkInviteLink({
        code: "code1",
        allowedDomains: ["bitwarden.com"],
      });
      inviteLinkClient.create_invite_link.mockResolvedValue(sdkInviteLink);

      await sut.createInviteLink(mockUserId, mockOrgId, ["bitwarden.com"], true);

      expect(inviteLinkClient.create_invite_link).toHaveBeenCalledWith(
        mockOrgId,
        ["bitwarden.com"],
        true,
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({
        [mockOrgId]: expect.objectContaining({
          id: "link-id",
          code: "code1",
          organizationId: mockOrgId,
          allowedDomains: ["bitwarden.com"],
          invite: "sealed-envelope-base64",
          supportsConfirmation: true,
          creationDate: "2024-01-01T00:00:00Z",
        }),
      });
    });

    it("throws when no domains are provided", async () => {
      await expect(sut.createInviteLink(mockUserId, mockOrgId, [], false)).rejects.toThrow(
        "At least one allowed domain is required.",
      );
    });

    it("surfaces SDK errors from invite link generation", async () => {
      inviteLinkClient.create_invite_link.mockRejectedValue(new Error("sdk crypto failure"));

      await expect(
        sut.createInviteLink(mockUserId, mockOrgId, ["example.com"], true),
      ).rejects.toThrow("sdk crypto failure");
    });
  });

  describe("updateAllowedDomains", () => {
    it("calls apiService.updateAllowedDomains with new domains and caches result", async () => {
      const response = makeResponseModel({ allowedDomains: ["updated.com"] });
      apiService.updateAllowedDomains.mockResolvedValue(response);

      await sut.updateAllowedDomains(mockUserId, mockOrgId, ["updated.com"]);

      expect(inviteLinkClient.create_invite_link).not.toHaveBeenCalled();
      expect(apiService.updateAllowedDomains).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["updated.com"] }),
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({ [mockOrgId]: new OrganizationInviteLink(response) });
    });

    it("throws when no domains are provided", async () => {
      await expect(sut.updateAllowedDomains(mockUserId, mockOrgId, [])).rejects.toThrow(
        "At least one allowed domain is required.",
      );
    });
  });

  describe("setInviteConfirmation", () => {
    it("passes the cached invite to the SDK and caches the returned link", async () => {
      await sut.upsert(mockUserId, makeInviteLink({ invite: "cached-invite" as Invite }));
      inviteLinkClient.set_invite_confirmation.mockResolvedValue(
        makeSdkInviteLink({ supportsConfirmation: false }),
      );

      await sut.setInviteConfirmation(mockUserId, mockOrgId, false);

      expect(inviteLinkClient.set_invite_confirmation).toHaveBeenCalledWith(
        mockOrgId,
        "cached-invite",
        false,
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({
        [mockOrgId]: expect.objectContaining({ supportsConfirmation: false }),
      });
    });

    it("reads the invite from the API when nothing is cached", async () => {
      apiService.get.mockResolvedValue(makeResponseModel({ invite: "from-api" as Invite }));

      await sut.setInviteConfirmation(mockUserId, mockOrgId, true);

      expect(inviteLinkClient.set_invite_confirmation).toHaveBeenCalledWith(
        mockOrgId,
        "from-api",
        true,
      );
    });

    it("throws without calling the SDK when the organization has no invite link", async () => {
      apiService.get.mockRejectedValue(new ErrorResponse(null, 404));

      await expect(sut.setInviteConfirmation(mockUserId, mockOrgId, false)).rejects.toThrow(
        "No invite link exists for this organization.",
      );
      expect(inviteLinkClient.set_invite_confirmation).not.toHaveBeenCalled();
    });

    it("surfaces SDK errors and leaves the cached link untouched", async () => {
      const cached = makeInviteLink();
      await sut.upsert(mockUserId, cached);
      inviteLinkClient.set_invite_confirmation.mockRejectedValue(new Error("sdk crypto failure"));

      await expect(sut.setInviteConfirmation(mockUserId, mockOrgId, false)).rejects.toThrow(
        "sdk crypto failure",
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({ [mockOrgId]: cached });
    });
  });

  describe("refreshInviteLink", () => {
    it("generates a new invite link via SDK and caches state", async () => {
      const sdkInviteLink = makeSdkInviteLink({ code: "refreshed", supportsConfirmation: false });
      inviteLinkClient.refresh_invite_link.mockResolvedValue(sdkInviteLink);

      await sut.refreshInviteLink(mockUserId, mockOrgId, false);

      expect(inviteLinkClient.refresh_invite_link).toHaveBeenCalledWith(mockOrgId, false);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({
        [mockOrgId]: expect.objectContaining({
          id: "link-id",
          code: "refreshed",
          organizationId: mockOrgId,
          allowedDomains: ["example.com"],
          invite: "sealed-envelope-base64",
          supportsConfirmation: false,
          creationDate: "2024-01-01T00:00:00Z",
        }),
      });
    });

    it("passes supportsConfirmation to the SDK when provided", async () => {
      inviteLinkClient.refresh_invite_link.mockResolvedValue(makeSdkInviteLink());

      await sut.refreshInviteLink(mockUserId, mockOrgId, true);

      expect(inviteLinkClient.refresh_invite_link).toHaveBeenCalledWith(mockOrgId, true);
    });

    it("surfaces SDK errors from invite link generation", async () => {
      inviteLinkClient.refresh_invite_link.mockRejectedValue(new Error("sdk crypto failure"));

      await expect(sut.refreshInviteLink(mockUserId, mockOrgId, false)).rejects.toThrow(
        "sdk crypto failure",
      );
    });
  });

  describe("reconstructUrl", () => {
    it("unseals the invite secret and builds URL from the provided invite link", async () => {
      const inviteLink = makeInviteLink({
        code: "reconstruct",
        invite: "sealed-envelope-base64" as Invite,
      });

      const url = await firstValueFrom(sut.reconstructUrl(mockUserId, mockOrgId, inviteLink));

      expect(inviteLinkClient.get_invite_secret).toHaveBeenCalledWith(
        mockOrgId,
        "sealed-envelope-base64",
      );
      expect(url).toBe(
        `https://vault.bitwarden.com/#/join/${mockOrgId}/reconstruct?key=unwrapped==`,
      );
    });
  });
});
