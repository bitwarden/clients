import { clearClipboardAlarmName } from "../../autofill/clipboard";
import { BrowserApi } from "../browser/browser-api";

export const alarmKeys = [clearClipboardAlarmName] as const;
export type AlarmKeys = (typeof alarmKeys)[number];

type AlarmState = { [T in AlarmKeys]: number | undefined };

const alarmState: AlarmState = {
  clearClipboard: null,
  //TODO once implemented vaultTimeout: null;
  //TODO once implemented checkNotifications: null;
  //TODO once implemented (if necessary) processReload: null;
};

/**
 * Retrieves the set alarm time (planned execution) for a give an commandName {@link AlarmState}
 * @param commandName A command that has been previously registered with {@link AlarmState}
 * @returns {Promise<number>} null or Unix epoch timestamp when the alarm action is supposed to execute
 * @example
 * // getAlarmTime(clearClipboard)
 */
export async function getAlarmTime(commandName: AlarmKeys): Promise<number> {
  let alarmTime: number;
  if (BrowserApi.isManifestVersion(3)) {
    const fromSessionStore = await chrome.storage.session.get(commandName);
    alarmTime = fromSessionStore[commandName];
  } else {
    alarmTime = alarmState[commandName];
  }

  return alarmTime;
}

/**
 * Registers an action that should execute after the given time has passed
 * @param commandName A command that has been previously registered with {@link AlarmState}
 * @param delay_ms The number of ms from now in which the command should execute from
 * @example
 * // setAlarmTime(clearClipboard, 5000) register the clearClipboard action which will execute when at least 5 seconds from now have passed
 */
export async function setAlarmTime(commandName: AlarmKeys, delay_ms: number): Promise<void> {
  if (!delay_ms || delay_ms === 0) {
    await this.clearAlarmTime(commandName);
    return;
  }

  const time = Date.now() + delay_ms;
  await setAlarmTimeInternal(commandName, time);
}

/**
 * Clears the time currently set for a given command
 * @param commandName A command that has been previously registered with {@link AlarmState}
 */
export async function clearAlarmTime(commandName: AlarmKeys): Promise<void> {
  await setAlarmTimeInternal(commandName, null);
}

async function setAlarmTimeInternal(commandName: AlarmKeys, time: number): Promise<void> {
  if (BrowserApi.isManifestVersion(3)) {
    await chrome.storage.session.set({ [commandName]: time });
  } else {
    alarmState[commandName] = time;
  }
}
