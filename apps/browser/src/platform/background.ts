import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import MainBackground from "../background/main.background";

const logService = new ConsoleLogService(false);
const bitwardenMain = ((self as any).bitwardenMain = new MainBackground());
try {
  bitwardenMain.syncBootstrap();
} catch (error) {
  logService.error(error);
}
bitwardenMain.bootstrap().catch((error) => logService.error(error));
