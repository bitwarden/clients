// Deep import: the `pam` barrel pulls Angular components into the worker bundle.
import { AccessLeasesSdkService } from "@bitwarden/bit-common/pam/services/access-leases-sdk.service";
import OssMainBackground from "@bitwarden/browser/background/main.background";

import { PamLeaseRefreshService } from "../pam/background/pam-lease-refresh.service";
import { BrowserRevealedCipherService } from "../pam/browser-revealed-cipher.service";
import { PamFillCipherPolicy } from "../pam/pam-fill-cipher-policy";

export default class MainBackground {
  private ossMain = new OssMainBackground({
    revealedCipherService: ({
      stateProvider,
      authService,
      cipherService,
      messageSender,
      logService,
    }) =>
      new BrowserRevealedCipherService(
        stateProvider,
        authService,
        cipherService,
        messageSender,
        logService,
      ),
    fillCipherPolicy: ({ cipherService, revealedCipherService }) =>
      new PamFillCipherPolicy(cipherService, revealedCipherService),
  });

  private pamLeaseRefreshService = new PamLeaseRefreshService(
    this.ossMain.stateProvider,
    this.ossMain.authService,
    this.ossMain.configService,
    this.ossMain.organizationService,
    new AccessLeasesSdkService(
      this.ossMain.sdkService,
      this.ossMain.accountService,
      this.ossMain.logService,
    ),
    this.ossMain.apiService,
    this.ossMain.serverNotificationsService,
    this.ossMain.syncService,
    this.ossMain.messageListener,
    this.ossMain.taskSchedulerService,
    this.ossMain.logService,
  );

  async bootstrap() {
    await this.ossMain.bootstrap();
    this.pamLeaseRefreshService.start();
  }
}
