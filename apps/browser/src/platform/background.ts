import MainBackground from "../background/main.background";

import { onAlarmListener } from "./alarms/on-alarm-listener";
import { registerAlarms } from "./alarms/register-alarms";
import { BrowserApi } from "./browser/browser-api";
import {
  contextMenusClickedListener,
  onCommandListener,
  onInstallListener,
  runtimeMessageListener,
  windowsOnFocusChangedListener,
  tabsOnActivatedListener,
  tabsOnReplacedListener,
  tabsOnUpdatedListener,
} from "./listeners";

if (BrowserApi.manifestVersion === 3) {
  chrome.commands.onCommand.addListener(onCommandListener);
  chrome.runtime.onInstalled.addListener(onInstallListener);
  chrome.alarms.onAlarm.addListener(onAlarmListener);
  registerAlarms();
  chrome.windows.onFocusChanged.addListener(windowsOnFocusChangedListener);
  chrome.tabs.onActivated.addListener(tabsOnActivatedListener);
  chrome.tabs.onReplaced.addListener(tabsOnReplacedListener);
  chrome.tabs.onUpdated.addListener(tabsOnUpdatedListener);
  chrome.contextMenus.onClicked.addListener(contextMenusClickedListener);
  BrowserApi.messageListener(
    "runtime.background",
    (message: { command: string }, sender, sendResponse) => {
      runtimeMessageListener(message, sender);
    }
  );
} else {
  const bitwardenMain = ((window as any).bitwardenMain = new MainBackground());
  bitwardenMain.bootstrap().then(() => {
    // Finished bootstrapping
  });
}
