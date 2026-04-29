import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { FakeActiveUserAccessor, FakeStateProvider } from "@bitwarden/state-test-utils";

import { OrganizationInviteLinkApiService } from "../abstractions/organization-invite-link-api.service";
import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";
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

describe("DefaultOrganizationInviteLinkService", () => {
  let sut: DefaultOrganizationInviteLinkService;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let apiService: MockProxy<OrganizationInviteLinkApiService>;
  let stateProvider: FakeStateProvider;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    keyGenerationService = mock<KeyGenerationService>();
    apiService = mock<OrganizationInviteLinkApiService>();

    const accessor = new FakeActiveUserAccessor(mockUserId);
    stateProvider = new FakeStateProvider(accessor);

    sut = new DefaultOrganizationInviteLinkService(
      keyService,
      encryptService,
      keyGenerationService,
      apiService,
      stateProvider,
    );
  });

  describe("inviteLink$", () => {
    it("emits undefined initially", async () => {
      const value = await firstValueFrom(sut.inviteLink$(mockUserId));
      expect(value).toBeUndefined();
    });

    it("emits stored value after upsert", async () => {
      const response = makeResponse();
      await sut.upsert(mockUserId, response);
      const value = await firstValueFrom(sut.inviteLink$(mockUserId));
      expect(value).toEqual(response);
    });

    it("emits undefined after clear", async () => {
      await sut.upsert(mockUserId, makeResponse());
      await sut.clear(mockUserId);
      const value = await firstValueFrom(sut.inviteLink$(mockUserId));
      expect(value).toBeUndefined();
    });
  });

  describe("upsert", () => {
    it("writes response to state", async () => {
      const response = makeResponse();
      await sut.upsert(mockUserId, response);
      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toEqual(response);
    });
  });

  describe("clear", () => {
    it("nulls local state without calling the API", async () => {
      await sut.upsert(mockUserId, makeResponse());
      await sut.clear(mockUserId);
      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toBeFalsy();
      expect(apiService.delete).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("calls API delete then clears local state", async () => {
      apiService.delete.mockResolvedValue();
      await sut.upsert(mockUserId, makeResponse());

      await sut.delete(mockUserId, mockOrgId);

      expect(apiService.delete).toHaveBeenCalledWith(mockOrgId);
      const stored = await firstValueFrom(
        stateProvider.getUser(mockUserId, ORGANIZATION_INVITE_LINK_KEY).state$,
      );
      expect(stored).toBeFalsy();
    });
  });

  describe("createInviteLink", () => {
    it("generates key, wraps with orgKey, calls API, caches in state, and emits URL", async () => {
      const rawKey = makeKey("rawkeyB64==");
      const orgKey = makeKey("orgkeyB64==");
      const encryptedKey = mock<EncString>();
      (encryptedKey as any).encryptedString = "2.enc=|iv=|mac=";
      const response = makeResponse({ code: "code1", allowedDomains: ["bitwarden.com"] });

      keyGenerationService.createKey.mockResolvedValue(rawKey);
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedKey);
      apiService.create.mockResolvedValue(response);

      const url = await sut.createInviteLink(mockUserId, mockOrgId, ["bitwarden.com"]);

      expect(keyGenerationService.createKey).toHaveBeenCalledWith(256);
      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(rawKey, orgKey);
      expect(apiService.create).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["bitwarden.com"] }),
      );
      expect(url).toBe("/#/join/code1?key=rawkeyB64==");

      const stored = await firstValueFrom(sut.inviteLink$(mockUserId));
      expect(stored).toEqual(response);
    });

    it("errors when orgKey is null", async () => {
      const rawKey = makeKey();
      keyGenerationService.createKey.mockResolvedValue(rawKey);
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject(null));

      await expect(sut.createInviteLink(mockUserId, mockOrgId, ["example.com"])).rejects.toThrow(
        `Organization key not found for org ${mockOrgId}`,
      );
    });
  });

  describe("refreshInviteLink", () => {
    it("re-uses cached domains", async () => {
      const cached = makeResponse({ allowedDomains: ["cached.com"] });
      await sut.upsert(mockUserId, cached);

      const rawKey = makeKey("refreshed==");
      const orgKey = makeKey();
      const encryptedKey = mock<EncString>();
      (encryptedKey as any).encryptedString = "2.enc=|iv=|mac=";
      const response = makeResponse({ code: "refreshed", allowedDomains: ["cached.com"] });

      keyGenerationService.createKey.mockResolvedValue(rawKey);
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedKey);
      apiService.create.mockResolvedValue(response);

      const url = await sut.refreshInviteLink(mockUserId, mockOrgId);

      expect(apiService.create).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ allowedDomains: ["cached.com"] }),
      );
      expect(url).toBe("/#/join/refreshed?key=refreshed==");
    });

    it("falls back to empty domains when no cache, propagating the domain validation error", async () => {
      const rawKey = makeKey();
      const orgKey = makeKey();
      const encryptedKey = mock<EncString>();
      (encryptedKey as any).encryptedString = "2.enc=|iv=|mac=";

      keyGenerationService.createKey.mockResolvedValue(rawKey);
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.wrapSymmetricKey.mockResolvedValue(encryptedKey);

      await expect(sut.refreshInviteLink(mockUserId, mockOrgId)).rejects.toThrow(
        "At least one allowed domain is required.",
      );
    });
  });

  describe("reconstructUrl", () => {
    it("calls API, unwraps key, caches, and emits URL", async () => {
      const response = makeResponse({
        code: "reconstruct",
        encryptedInviteKey: "2.enc=|iv=|mac=",
      });
      const orgKey = makeKey();
      const rawKey = makeKey("unwrapped==");

      apiService.get.mockResolvedValue(response);
      keyService.orgKeys$.mockReturnValue(new BehaviorSubject({ [mockOrgId]: orgKey as OrgKey }));
      encryptService.unwrapSymmetricKey.mockResolvedValue(rawKey);

      const url = await sut.reconstructUrl(mockUserId, mockOrgId);

      expect(apiService.get).toHaveBeenCalledWith(mockOrgId);
      expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(expect.any(EncString), orgKey);
      expect(url).toBe("/#/join/reconstruct?key=unwrapped==");

      const stored = await firstValueFrom(sut.inviteLink$(mockUserId));
      expect(stored).toEqual(response);
    });

    it("returns undefined when API returns null", async () => {
      apiService.get.mockResolvedValue(null);

      const url = await sut.reconstructUrl(mockUserId, mockOrgId);

      expect(url).toBeUndefined();
    });
  });
});
