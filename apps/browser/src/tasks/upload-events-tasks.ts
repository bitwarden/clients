import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";

import { Account } from "../models/account";
import { setAlarmTime } from "../platform/alarms/alarm-state";
import { CachedServices } from "../platform/background/service-factories/factory-options";
import { eventUploadServiceFactory } from "../tools/background/service_factories/event-upload-service.factory";

export const uploadEventAlarmName = "uploadEvents";

const opts = {
  cryptoFunctionServiceOptions: {
    win: self,
  },
  encryptServiceOptions: {
    logMacFailures: true,
  },
  logServiceOptions: {
    isDev: false,
  },
  platformUtilsServiceOptions: {
    clipboardWriteCallback: () => Promise.resolve(),
    biometricCallback: () => Promise.resolve(false),
    win: self,
  },
  stateServiceOptions: {
    stateFactory: new StateFactory(GlobalState, Account),
  },
  stateMigrationServiceOptions: {
    stateFactory: new StateFactory(GlobalState, Account),
  },
  apiServiceOptions: {
    logoutCallback: () => Promise.resolve(),
  },
};

export class UploadEventsTask {
  static async run(serviceCache: CachedServices) {
    const eventUploadService = await eventUploadServiceFactory(serviceCache, opts);
    eventUploadService.uploadEvents();

    await setAlarmTime(uploadEventAlarmName, 60 * 1000);
  }
}
