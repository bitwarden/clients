import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrganizationInviteLinkView as SdkOrganizationInviteLinkView } from "@bitwarden/sdk-internal";
import { FakeActiveUserAccessor, FakeStateProvider } from "@bitwarden/state-test-utils";

import { OrganizationInviteLinkView } from "../models/organization-invite-link.view";
import { ORGANIZATION_INVITE_LINK_KEY } from "../state/organization-invite-link-state";

import { DefaultOrganizationInviteLinkService } from "./default-organization-invite-link.service";

const mockUserId = "user-1" as UserId;
const mockOrgId = "12345678-1234-1234-1234-123456789012" as OrganizationId;
const webVaultUrl = "https://vault.bitwarden.com";
const urlFragment = "/#/join/org/code?key=secret";
const expectedUrl = `${webVaultUrl}${urlFragment}`;

function makeSdkView(
  overrides: Partial<SdkOrganizationInviteLinkView> = {},
): SdkOrganizationInviteLinkView {
  return {
    id: "link-id",
    organizationId: mockOrgId,
    allowedDomains: ["example.com"],
    supportsConfirmation: true,
    creationDate: "2024-01-01T00:00:00Z",
    urlFragment,
    ...overrides,
  } as SdkOrganizationInviteLinkView;
}

function makeView(overrides: Partial<OrganizationInviteLinkView> = {}): OrganizationInviteLinkView {
  return Object.assign(new OrganizationInviteLinkView({} as any), {
    id: "link-id",
    organizationId: mockOrgId,
    allowedDomains: ["example.com"],
    supportsConfirmation: true,
    creationDate: "2024-01-01T00:00:00Z",
    url: expectedUrl,
    ...overrides,
  });
}

describe("DefaultOrganizationInviteLinkService", () => {
  let sut: DefaultOrganizationInviteLinkService;
  let stateProvider: FakeStateProvider;
  let environmentService: MockProxy<EnvironmentService>;
  let sdkService: MockSdkService;
  let inviteLinkClient: {
    get: jest.Mock;
    create: jest.Mock;
    refresh: jest.Mock;
    update_allowed_domains: jest.Mock;
    update_confirmation: jest.Mock;
    delete: jest.Mock;
  };

  function seedCache(view: OrganizationInviteLinkView) {
    return stateProvider
      .getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY)
      .update(() => ({ [mockOrgId]: view }));
  }

  beforeEach(() => {
    environmentService = mock<EnvironmentService>();
    const mockEnvironment = mock<Environment>();
    mockEnvironment.getWebVaultUrl.mockReturnValue(webVaultUrl);
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
      get: jest.fn().mockResolvedValue(makeSdkView()),
      create: jest.fn().mockResolvedValue(makeSdkView()),
      refresh: jest.fn().mockResolvedValue(makeSdkView()),
      update_allowed_domains: jest.fn().mockResolvedValue(makeSdkView()),
      update_confirmation: jest.fn().mockResolvedValue(makeSdkView()),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    (sdkClient as any).invite_link = jest
      .fn()
      .mockReturnValue({ admin: jest.fn().mockReturnValue(inviteLinkClient) });

    sut = new DefaultOrganizationInviteLinkService(stateProvider, environmentService, sdkService);
  });

  describe("inviteLink$", () => {
    it("fetches from the SDK when cache is empty and builds the full url", async () => {
      inviteLinkClient.get.mockResolvedValue(makeSdkView());

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(inviteLinkClient.get).toHaveBeenCalledWith(mockOrgId);
      expect(value).toEqual(makeView());
    });

    it("returns undefined when the SDK returns undefined", async () => {
      inviteLinkClient.get.mockResolvedValue(undefined);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(value).toBeUndefined();
    });

    it("emits cached value without calling the SDK again", async () => {
      const inviteLink = makeView();
      await seedCache(inviteLink);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(inviteLinkClient.get).not.toHaveBeenCalled();
      expect(value).toEqual(inviteLink);
    });

    it("propagates SDK errors", async () => {
      inviteLinkClient.get.mockRejectedValue(new Error("sdk failure"));

      await expect(firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId))).rejects.toThrow(
        "sdk failure",
      );
    });
  });

  describe("delete", () => {
    it("calls the SDK delete and clears local state", async () => {
      await seedCache(makeView());

      await sut.delete(mockUserId, mockOrgId);

      expect(inviteLinkClient.delete).toHaveBeenCalledWith(mockOrgId);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored?.[mockOrgId]).toBeUndefined();
    });
  });

  describe("createInviteLink", () => {
    it("generates the invite link via the SDK and caches the result with the full url", async () => {
      inviteLinkClient.create.mockResolvedValue(makeSdkView({ allowedDomains: ["bitwarden.com"] }));

      await sut.create(mockUserId, mockOrgId, ["bitwarden.com"], true);

      expect(inviteLinkClient.create).toHaveBeenCalledWith(mockOrgId, ["bitwarden.com"], true);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({
        [mockOrgId]: expect.objectContaining({
          id: "link-id",
          organizationId: mockOrgId,
          allowedDomains: ["bitwarden.com"],
          supportsConfirmation: true,
          creationDate: "2024-01-01T00:00:00Z",
          url: expectedUrl,
        }),
      });
    });

    it("throws when no domains are provided", async () => {
      await expect(sut.create(mockUserId, mockOrgId, [], false)).rejects.toThrow(
        "At least one allowed domain is required.",
      );
    });

    it("surfaces SDK errors from invite link generation", async () => {
      inviteLinkClient.create.mockRejectedValue(new Error("sdk crypto failure"));

      await expect(sut.create(mockUserId, mockOrgId, ["example.com"], true)).rejects.toThrow(
        "sdk crypto failure",
      );
    });
  });

  describe("updateAllowedDomains", () => {
    it("updates allowed domains via the SDK and caches the result", async () => {
      inviteLinkClient.update_allowed_domains.mockResolvedValue(
        makeSdkView({ allowedDomains: ["updated.com"] }),
      );

      await sut.updateAllowedDomains(mockUserId, mockOrgId, ["updated.com"]);

      expect(inviteLinkClient.update_allowed_domains).toHaveBeenCalledWith(mockOrgId, [
        "updated.com",
      ]);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({
        [mockOrgId]: expect.objectContaining({
          allowedDomains: ["updated.com"],
          url: expectedUrl,
        }),
      });
    });

    it("throws when no domains are provided", async () => {
      await expect(sut.updateAllowedDomains(mockUserId, mockOrgId, [])).rejects.toThrow(
        "At least one allowed domain is required.",
      );
    });
  });

  describe("setInviteConfirmation", () => {
    it("updates the confirmation setting via the SDK and caches the returned link", async () => {
      inviteLinkClient.update_confirmation.mockResolvedValue(
        makeSdkView({ supportsConfirmation: false }),
      );

      await sut.setInviteConfirmation(mockUserId, mockOrgId, false);

      expect(inviteLinkClient.update_confirmation).toHaveBeenCalledWith(mockOrgId, false);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({
        [mockOrgId]: expect.objectContaining({ supportsConfirmation: false, url: expectedUrl }),
      });
    });

    it("surfaces SDK errors and leaves the cached link untouched", async () => {
      const cached = makeView();
      await seedCache(cached);
      inviteLinkClient.update_confirmation.mockRejectedValue(new Error("sdk crypto failure"));

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
    it("generates a new invite link via the SDK and caches state", async () => {
      inviteLinkClient.refresh.mockResolvedValue(makeSdkView({ supportsConfirmation: false }));

      await sut.refresh(mockUserId, mockOrgId, false);

      expect(inviteLinkClient.refresh).toHaveBeenCalledWith(mockOrgId, false);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({
        [mockOrgId]: expect.objectContaining({
          id: "link-id",
          organizationId: mockOrgId,
          supportsConfirmation: false,
          url: expectedUrl,
        }),
      });
    });

    it("passes supportsConfirmation to the SDK when provided", async () => {
      inviteLinkClient.refresh.mockResolvedValue(makeSdkView());

      await sut.refresh(mockUserId, mockOrgId, true);

      expect(inviteLinkClient.refresh).toHaveBeenCalledWith(mockOrgId, true);
    });

    it("surfaces SDK errors from invite link generation", async () => {
      inviteLinkClient.refresh.mockRejectedValue(new Error("sdk crypto failure"));

      await expect(sut.refresh(mockUserId, mockOrgId, false)).rejects.toThrow("sdk crypto failure");
    });
  });
});
