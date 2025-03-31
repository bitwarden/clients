import { mock } from "jest-mock-extended";

import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultLockService } from "./lock.service";

describe("DefaultLockService", () => {
  const mockUser1 = "user1" as UserId;
  const mockUser2 = "user2" as UserId;
  const mockUser3 = "user3" as UserId;

  const accountService = mockAccountServiceWith(mockUser1);
  const vaultTimeoutService = mock<VaultTimeoutService>();

  const sut = new DefaultLockService(accountService, vaultTimeoutService);
  describe("lockAll", () => {
    it("locks the active account last", async () => {
      await accountService.addAccount(mockUser2, {
        name: "name2",
        email: "email2@example.com",
        emailVerified: false,
      });

      await accountService.addAccount(mockUser3, {
        name: "name3",
        email: "email3@example.com",
        emailVerified: false,
      });

      await sut.lockAll();

      expect(vaultTimeoutService.lock).toHaveBeenCalledTimes(3);
      // Non-Active users should be called first
      expect(vaultTimeoutService.lock).toHaveBeenNthCalledWith(1, mockUser2);
      expect(vaultTimeoutService.lock).toHaveBeenNthCalledWith(2, mockUser3);

      // Active user should be called last
      expect(vaultTimeoutService.lock).toHaveBeenNthCalledWith(3, mockUser1);
    });
  });
});
