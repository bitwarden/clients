import { BrowserApi } from "../platform/browser/browser-api";

/** Asks the background to apply the "On system lock" session timeout, as when the screen locks. */
export const SYSTEM_LOCKED = "systemLocked";

/** Sends {@link SYSTEM_LOCKED} from an extension page and resolves once the background applied it. */
export async function requestSystemLocked(): Promise<void> {
  const response = await BrowserApi.sendMessageWithResponse<{ error?: { message: string } }>(
    SYSTEM_LOCKED,
  );
  if (response?.error != null) {
    throw new Error(response.error.message);
  }
}
