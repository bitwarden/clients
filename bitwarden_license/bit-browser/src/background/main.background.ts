// Deep import: the `pam` barrel pulls Angular components into the worker bundle.
import { AccessLeasesSdkService } from "@bitwarden/bit-common/pam/services/access-leases-sdk.service";
import OssMainBackground from "@bitwarden/browser/background/main.background";

import { PamLeaseRefreshService } from "../pam/background/pam-lease-refresh.service";
import { BrowserRevealedCipherService } from "../pam/browser-revealed-cipher.service";

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
    async () => {
      await this.ossMain.updateOverlayCiphers();
      await this.ossMain.refreshMenu();
    },
  );

  async bootstrap() {
    await this.ossMain.bootstrap();
    this.pamLeaseRefreshService.start();
  }
}
