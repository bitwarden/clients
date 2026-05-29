import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

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

function makeResponseModel(
  overrides: Partial<OrganizationInviteLinkResponseModel> = {},
): OrganizationInviteLinkResponseModel {
  const resp = mock<OrganizationInviteLinkResponseModel>();
  resp.id = "link-id";
  resp.code = "abc123";
  resp.allowedDomains = ["example.com"];
  resp.encryptedInviteKey = "2.enc=|iv=|mac=";
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
    const environmentSubject = new BehaviorSubject<Environment>(mockEnvironment);
    Object.defineProperty(environmentService, "environment$", {
      get: () => environmentSubject.asObservable(),
      configurable: true,
    });

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
    it("generates key, wraps with orgKey, calls API, and caches result", async () => {
      const orgKey = makeKey("orgkeyB64==");
      const encryptedKey = mock<EncString>();
      (encryptedKey as any).encryptedString = "2.enc=|iv=|mac=";
      const response = makeResponseModel({ code: "code1", allowedDomains: ["bitwarden.com"] });

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
      expect(stored).toEqual({ [mockOrgId]: new OrganizationInviteLink(response) });
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
      const rawKey = makeKey("refreshed==");
      const orgKey = makeKey();
      const encryptedKey = mock<EncString>();
      (encryptedKey as any).encryptedString = "2.enc=|iv=|mac=";
      const response = makeResponseModel({ code: "refreshed", allowedDomains: ["example.com"] });

      keyGenerationService.createKey.mockResolvedValue(rawKey);
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedKey);
      apiService.refresh.mockResolvedValue(response);

      await sut.refreshInviteLink(mockUserId, mockOrgId);

      expect(keyGenerationService.createKey).toHaveBeenCalledWith(256);
      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(rawKey, orgKey);
      expect(apiService.refresh).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ encryptedInviteKey: "2.enc=|iv=|mac=" }),
      );

      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual({ [mockOrgId]: new OrganizationInviteLink(response) });
    });

    it("errors when orgKey is null", async () => {
      const rawKey = makeKey();
      keyGenerationService.createKey.mockResolvedValue(rawKey);
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject(null));

      await expect(sut.refreshInviteLink(mockUserId, mockOrgId)).rejects.toThrow(
        `Organization key not found for org ${mockOrgId}`,
      );
    });
  });

  describe("reconstructUrl", () => {
    it("unwraps key and builds URL from the provided invite link", async () => {
      const inviteLink = makeInviteLink({
        code: "reconstruct",
        encryptedInviteKey: "2.enc=|iv=|mac=",
      });

      const orgKey = makeKey();
      const rawKey = makeKey("unwrapped==");

      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.unwrapSymmetricKey.mockResolvedValue(rawKey);

      const url = await firstValueFrom(sut.reconstructUrl(mockUserId, mockOrgId, inviteLink));

      expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(expect.any(EncString), orgKey);
      expect(url).toBe("https://vault.bitwarden.com/#/join/reconstruct?key=unwrapped==");
    });
  });
});
