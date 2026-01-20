import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ProviderId, UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
import { ProviderUser } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

import { ProviderActionsService } from "./provider-actions.service";

describe("ProviderActionsService", () => {
  let service: ProviderActionsService;
  let apiService: MockProxy<ApiService>;
  let keyService: MockProxy<KeyService>;
  let accountService: MockProxy<AccountService>;
  let encryptService: MockProxy<EncryptService>;

  const providerId = newGuid() as ProviderId;
  const userId = newGuid();
  const userIdToManage = newGuid();

  let mockProviderUser: ProviderUser;

  beforeEach(() => {
    apiService = mock<ApiService>();
    keyService = mock<KeyService>();
    accountService = mock<AccountService>();
    encryptService = mock<EncryptService>();

    mockProviderUser = {
      id: userIdToManage,
      userId: userIdToManage,
      email: "test@example.com",
      name: "Test User",
    } as ProviderUser;

    TestBed.configureTestingModule({
      providers: [
        ProviderActionsService,
        { provide: ApiService, useValue: apiService },
        { provide: KeyService, useValue: keyService },
        { provide: AccountService, useValue: accountService },
        { provide: EncryptService, useValue: encryptService },
      ],
    });

    service = TestBed.inject(ProviderActionsService);
  });

  describe("deleteProviderUser", () => {
    it("should return success when deletion succeeds", async () => {
      apiService.deleteProviderUser.mockResolvedValue(undefined);

      const result = await service.deleteProviderUser(providerId, mockProviderUser);

      expect(result.success).toBe(true);
    });

    it("should return error when deletion fails", async () => {
      apiService.deleteProviderUser.mockRejectedValue(new Error("Delete failed"));

      const result = await service.deleteProviderUser(providerId, mockProviderUser);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("reinviteProvider", () => {
    it("should return success when reinvite succeeds", async () => {
      apiService.postProviderUserReinvite.mockResolvedValue(undefined);

      const result = await service.reinviteProvider(providerId, mockProviderUser);

      expect(result.success).toBe(true);
    });

    it("should return error when reinvite fails", async () => {
      apiService.postProviderUserReinvite.mockRejectedValue(new Error("Reinvite failed"));

      const result = await service.reinviteProvider(providerId, mockProviderUser);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("confirmProvider", () => {
    const publicKey = new Uint8Array([1, 2, 3, 4, 5]);

    it("should return success when confirmation succeeds", async () => {
      const mockAccount: Account = {
        id: userId as UserId,
        email: "test@example.com",
        emailVerified: true,
        name: "Test User",
        creationDate: new Date(),
      };
      const activeAccount$ = new BehaviorSubject<Account | null>(mockAccount);
      accountService.activeAccount$ = activeAccount$;
      keyService.providerKeys$.mockReturnValue(of({ [providerId]: { key: "mock" } as any }));
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(new EncString("encrypted"));
      apiService.postProviderUserConfirm.mockResolvedValue(undefined);

      const result = await service.confirmProvider(mockProviderUser, providerId, publicKey);

      expect(result.success).toBe(true);
    });

    it("should return error when confirmation fails", async () => {
      const mockAccount: Account = {
        id: userId as UserId,
        email: "test@example.com",
        emailVerified: true,
        name: "Test User",
        creationDate: new Date(),
      };
      const activeAccount$ = new BehaviorSubject<Account | null>(mockAccount);
      accountService.activeAccount$ = activeAccount$;
      keyService.providerKeys$.mockReturnValue(of({}));

      const result = await service.confirmProvider(mockProviderUser, providerId, publicKey);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
