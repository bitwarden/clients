import { inject, Injectable } from "@angular/core";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LockService } from "@bitwarden/auth/common";
import { firstValueFrom } from "rxjs";

@Injectable({ providedIn: "root" })
export class LockBridgeService {
  private readonly lockService = inject(LockService);
  private readonly accountService = inject(AccountService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  async lock(): Promise<void> {
    const userId = await firstValueFrom(this.activeUserId$);
    await this.lockService.lock(userId);
  }
}
