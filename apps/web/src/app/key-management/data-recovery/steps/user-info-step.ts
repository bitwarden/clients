import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyService } from "@bitwarden/key-management";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

export class UserInfoStep extends RecoveryStep {
  title = "recoveryStepUserInfoTitle";

  constructor(
    private accountService: AccountService,
    private keyService: KeyService,
  ) {
    super();
  }

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount) {
      logger.record("No active account found");
      return false;
    }
    const userId = activeAccount.id;
    workingData.userId = userId;
    logger.record(`User ID: ${userId}`);

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      logger.record("No user key found");
      return false;
    }
    workingData.userKey = userKey;
    logger.record(
      `User encryption type: ${userKey.inner().type === 2 ? "V1" : userKey.inner().type === 7 ? "Cose" : "Unknown"}`,
    );

    return true;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    return false;
  }

  runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    return Promise.resolve();
  }
}
