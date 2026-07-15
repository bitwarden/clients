import { browser } from "@wdio/globals";

/**
 * Best-effort wait for the number of open top-level windows/tabs to reach `count`. Resolves when
 * the count is met and swallows the timeout otherwise, so callers can treat "never reached" as a
 * valid state rather than a failure.
 */
export async function waitForWindowCount(
  count: number,
  { timeout = 5000, interval = 250 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
  try {
    await browser.waitUntil(async () => (await browser.getWindowHandles()).length >= count, {
      timeout,
      interval,
    });
  } catch {
    // The count was never reached within the timeout; a valid state for callers.
  }
}

/**
 * Closes every open top-level window/tab except `keep` (defaults to the current window), then
 * switches back to `keep`. Tolerates handles whose context has already gone away. Returns the
 * retained handle.
 */
export async function closeOtherWindows(keep?: string): Promise<string> {
  const retained = keep ?? (await browser.getWindowHandle());

  const handles = await browser.getWindowHandles();
  for (const handle of handles) {
    if (handle === retained) {
      continue;
    }
    try {
      await browser.switchToWindow(handle);
      await browser.closeWindow();
    } catch {
      // The context may have already closed; keep closing the rest.
    }
  }

  await browser.switchToWindow(retained);
  return retained;
}
