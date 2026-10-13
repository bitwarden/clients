import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { LockService, LockSource, UnlockService } from "@bitwarden/unlock";

import { LockCapability } from "./lock";

describe("LockCapability", () => {
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;
  const otherUserId = "other-user-id" as UserId;

  let accountService: ReturnType<typeof mock<AccountService>>;
  let authService: ReturnType<typeof mock<AuthService>>;
  let lockService: ReturnType<typeof mock<LockService>>;
  let unlockService: ReturnType<typeof mock<UnlockService>>;
  let sut: LockCapability;

  beforeEach(() => {
    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    lockService = mock<LockService>();
    unlockService = mock<UnlockService>();
    sut = new LockCapability(accountService, authService, lockService, unlockService);
  });

  it("lists the lock status of every known account", async () => {
    accountService.accounts$ = of({
      [userId]: {
        email: "user@example.com",
        emailVerified: true,
        name: "User",
        creationDate: undefined,
      },
      [otherUserId]: {
        email: "other@example.com",
        emailVerified: true,
        name: "Other",
        creationDate: undefined,
      },
    });
    authService.authStatuses$ = of({
      [userId]: AuthenticationStatus.Unlocked,
      [otherUserId]: AuthenticationStatus.Locked,
    } as Record<UserId, AuthenticationStatus>);

    await expect(sut.listUsers()).resolves.toEqual([
      { userId, email: "user@example.com", status: "Unlocked" },
      { userId: otherUserId, email: "other@example.com", status: "Locked" },
    ]);
  });

  it("reports users with no auth status as logged out", async () => {
    accountService.accounts$ = of({
      [userId]: {
        email: "user@example.com",
        emailVerified: true,
        name: "User",
        creationDate: undefined,
      },
    });
    authService.authStatuses$ = of({} as Record<UserId, AuthenticationStatus>);

    const [status] = await sut.listUsers();

    expect(status.status).toBe("LoggedOut");
  });

  it("locks a user manually", async () => {
    await sut.lock(userId);

    expect(lockService.lock).toHaveBeenCalledWith(userId, LockSource.Manual);
  });

  it("unlocks with a master password", async () => {
    await sut.unlockWithMasterPassword(userId, "pw");

    expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(userId, "pw");
  });

  it("unlocks with a pin", async () => {
    await sut.unlockWithPin(userId, "1234");

    expect(unlockService.unlockWithPin).toHaveBeenCalledWith(userId, "1234");
  });

  it("unlocks with biometrics", async () => {
    await sut.unlockWithBiometrics(userId);

    expect(unlockService.unlockWithBiometrics).toHaveBeenCalledWith(userId);
  });
});
