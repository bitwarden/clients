import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { LockService, LockSource, UnlockService } from "@bitwarden/unlock";

import { AutomationCapability } from "../automation-capability";

/** Lock state of a single known account. */
export interface UserLockStatus {
  userId: UserId;
  email: string;
  status: keyof typeof AuthenticationStatus;
}

/** Inspects and changes the lock state of known accounts. */
export class LockCapability extends AutomationCapability {
  readonly automationName = "lock";

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private lockService: LockService,
    private unlockService: UnlockService,
  ) {
    super();
  }

  /** Lock status of every known account. */
  async listUsers(): Promise<UserLockStatus[]> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    const statuses = await firstValueFrom(this.authService.authStatuses$);

    return Object.entries(accounts).map(([userId, account]) => ({
      userId: userId as UserId,
      email: account.email,
      status: AuthenticationStatus[
        statuses[userId as UserId] ?? AuthenticationStatus.LoggedOut
      ] as keyof typeof AuthenticationStatus,
    }));
  }

  /** Lock a user, as if they had locked the vault themselves. */
  async lock(userId: UserId): Promise<void> {
    await this.lockService.lock(userId, LockSource.Manual);
  }

  async unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void> {
    await this.unlockService.unlockWithMasterPassword(userId, masterPassword);
  }

  async unlockWithPin(userId: UserId, pin: string): Promise<void> {
    await this.unlockService.unlockWithPin(userId, pin);
  }

  async unlockWithBiometrics(userId: UserId): Promise<void> {
    await this.unlockService.unlockWithBiometrics(userId);
  }
}
