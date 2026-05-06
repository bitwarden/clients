import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { FakeActiveUserAccessor, FakeStateProvider } from "@bitwarden/state-test-utils";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkResponseModel,
} from "../models/responses/organization-invite-link.response";
import { ORGANIZATION_INVITE_LINK_KEY } from "../state/organization-invite-link-state";

import { DefaultOrganizationInviteLinkService } from "./default-organization-invite-link.service";

const mockUserId = "user-1" as UserId;
const mockOrgId = "org-1" as OrganizationId;

function makeKey(keyB64 = "dGVzdGtleWJ5dGVzZm9ydGVzdGluZw=="): SymmetricCryptoKey {
  const key = mock<SymmetricCryptoKey>();
  key.keyB64 = keyB64;
  return key;
}

function makeResponse(
  overrides: Partial<OrganizationInviteLinkResponseModel> = {},
): OrganizationInviteLinkResponseModel {
  const resp = mock<OrganizationInviteLinkResponseModel>();
  resp.code = "abc123";
  resp.allowedDomains = ["example.com"];
  resp.encryptedInviteKey = "2.enc=|iv=|mac=";
  resp.organizationId = mockOrgId;
  return Object.assign(resp, overrides);
}

function makeInviteLink(overrides: Partial<OrganizationInviteLink> = {}): OrganizationInviteLink {
  return Object.assign(new OrganizationInviteLink(makeResponse()), overrides);
}

describe("DefaultOrganizationInviteLinkService", () => {
  let sut: DefaultOrganizationInviteLinkService;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let apiService: MockProxy<OrganizationInviteLinkApiService>;
  let stateProvider: FakeStateProvider;
  let environmentService: MockProxy<EnvironmentService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    keyGenerationService = mock<KeyGenerationService>();
    apiService = mock<OrganizationInviteLinkApiService>();
    environmentService = mock<EnvironmentService>();
    const mockEnvironment = mock<Environment>();
    mockEnvironment.getWebVaultUrl.mockReturnValue("https://vault.bitwarden.com");
    environmentService.environment$ = of(mockEnvironment);

    const accessor = new FakeActiveUserAccessor(mockUserId);
    stateProvider = new FakeStateProvider(accessor);

    sut = new DefaultOrganizationInviteLinkService(
      keyService,
      encryptService,
      keyGenerationService,
      apiService,
      stateProvider,
      environmentService,
    );
  });

  describe("inviteLink$", () => {
    it("fetches from API and emits when no state is cached", async () => {
      const response = makeResponse();
      apiService.get.mockResolvedValue(response);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(value).toEqual(new OrganizationInviteLink(response));
    });

    it("emits undefined when API returns 404", async () => {
      const notFound = Object.assign(new ErrorResponse({}, 404), { statusCode: 404 });
      apiService.get.mockRejectedValue(notFound);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(value).toBeUndefined();
    });

    it("propagates non-404 API errors", async () => {
      const serverError = Object.assign(new ErrorResponse({}, 500), { statusCode: 500 });
      apiService.get.mockRejectedValue(serverError);

      await expect(firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId))).rejects.toMatchObject({
        statusCode: 500,
      });
    });

    it("emits cached value and skips API when state exists", async () => {
      const link = makeInviteLink();
      await sut.upsert(mockUserId, link);

      const value = await firstValueFrom(sut.inviteLink$(mockUserId, mockOrgId));

      expect(apiService.get).not.toHaveBeenCalled();
      expect(value).toEqual(link);
    });
  });

  describe("upsert", () => {
    it("persists the invite link to state", async () => {
      const link = makeInviteLink();
      await sut.upsert(mockUserId, link);

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual(link);
    });
  });

  describe("delete", () => {
    it("clears state and calls API delete", async () => {
      apiService.delete.mockResolvedValue();
      await sut.upsert(mockUserId, makeInviteLink());

      await sut.delete(mockUserId, mockOrgId);

      expect(apiService.delete).toHaveBeenCalledWith(mockOrgId);
      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toBeFalsy();
    });
  });

  describe("createInviteLink", () => {
    it("calls API create with the provided domains and caches the result", async () => {
      const orgKey = makeKey();
      const encryptedKey = mock<EncString>();
      (encryptedKey as any).encryptedString = "2.enc=|iv=|mac=";
      const response = makeResponse({ allowedDomains: ["bitwarden.com"] });

      keyGenerationService.createKey.mockResolvedValue(makeKey());
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedKey);
      apiService.create.mockResolvedValue(response);

      await sut.createInviteLink(mockUserId, mockOrgId, ["bitwarden.com"]);

      expect(apiService.create).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["bitwarden.com"] }),
      );
      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual(new OrganizationInviteLink(response));
    });

    it("throws when no domains are provided", async () => {
      const orgKey = makeKey();
      const encryptedKey = mock<EncString>();
      (encryptedKey as any).encryptedString = "2.enc=|iv=|mac=";

      keyGenerationService.createKey.mockResolvedValue(makeKey());
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedKey);

      await expect(sut.createInviteLink(mockUserId, mockOrgId, [])).rejects.toThrow();
    });

    it("throws when orgKey is missing", async () => {
      keyGenerationService.createKey.mockResolvedValue(makeKey());
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject(null));

      await expect(sut.createInviteLink(mockUserId, mockOrgId, ["example.com"])).rejects.toThrow();
    });
  });

  describe("updateInviteLink", () => {
    it("calls API update with the provided domains and caches the result", async () => {
      const response = makeResponse({ allowedDomains: ["updated.com"] });
      apiService.update.mockResolvedValue(response);

      await sut.updateInviteLink(mockUserId, mockOrgId, ["updated.com"]);

      expect(apiService.update).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["updated.com"] }),
      );
      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual(new OrganizationInviteLink(response));
    });

    it("throws when no domains are provided", async () => {
      await expect(sut.updateInviteLink(mockUserId, mockOrgId, [])).rejects.toThrow();
    });
  });

  describe("refreshInviteLink", () => {
    it("calls updateInviteLink using cached allowed domains", async () => {
      await sut.upsert(mockUserId, makeInviteLink({ allowedDomains: ["cached.com"] }));
      const response = makeResponse({ allowedDomains: ["cached.com"] });
      apiService.update.mockResolvedValue(response);

      await sut.refreshInviteLink(mockUserId, mockOrgId);

      expect(apiService.update).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["cached.com"] }),
      );
    });

    it("throws when there is no cached link and no existing invite link", async () => {
      const notFound = Object.assign(new ErrorResponse({}, 404), { statusCode: 404 });
      apiService.get.mockRejectedValue(notFound);

      await expect(sut.refreshInviteLink(mockUserId, mockOrgId)).rejects.toThrow();
    });
  });
});
