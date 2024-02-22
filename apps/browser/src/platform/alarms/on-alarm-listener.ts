import { ClearClipboard, clearClipboardAlarmName } from "../../autofill/clipboard";
import { uploadEventAlarmName, UploadEventsTask } from "../../tasks/upload-events-tasks";
import { CachedServices } from "../background/service-factories/factory-options";

import { alarmKeys, clearAlarmTime, getAlarmTime } from "./alarm-state";

export const onAlarmListener = async (alarm: chrome.alarms.Alarm) => {
  const serviceCache: CachedServices = {};

  alarmKeys.forEach(async (key) => {
    const executionTime = await getAlarmTime(key);
    if (!executionTime) {
      return;
    }

    const currentDate = Date.now();
    if (executionTime > currentDate) {
      return;
    }

    await clearAlarmTime(key);

    switch (key) {
      case clearClipboardAlarmName:
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ClearClipboard.run();
        break;
      case uploadEventAlarmName:
        UploadEventsTask.run(serviceCache);
        break;
      default:
    }
  });
};
