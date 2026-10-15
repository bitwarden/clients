import OssMainBackground from "@bitwarden/browser/background/main.background";

import { PamLeaseRefreshService } from "../pam/background/pam-lease-refresh.service";
import { BrowserCipherLeaseStateService } from "../pam/browser-cipher-lease-state.service";

export default class MainBackground {
  private ossMain = new OssMainBackground({
    cipherLeaseStateService: ({ stateProvider, accountService }) =>
      new BrowserCipherLeaseStateService(stateProvider, accountService),
  });

  private pamLeaseRefreshService = new PamLeaseRefreshService(
    this.ossMain.stateProvider,
    this.ossMain.authService,
    this.ossMain.configService,
    this.ossMain.organizationService,
    this.ossMain.sdkService,
    this.ossMain.apiService,
    this.ossMain.serverNotificationsService,
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
