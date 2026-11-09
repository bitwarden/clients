import { ElectronApplication } from "@playwright/test";

const MAIN_LOG_TIMEOUT_MS = 15_000;

/**
 * Resolves once the main process logs `text`. Call before the action that causes it: the log is
 * a stream, and a line written before this subscribes is missed.
 */
export function mainLogged(app: ElectronApplication, text: string): Promise<void> {
  const stdout = app.process().stdout!;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stdout.off("data", onData);
      reject(new Error(`The main process never logged "${text}"`));
    }, MAIN_LOG_TIMEOUT_MS);

    function onData(chunk: Buffer) {
      if (!chunk.toString().includes(text)) {
        return;
      }

      clearTimeout(timer);
      stdout.off("data", onData);
      resolve();
    }

    stdout.on("data", onData);
  });
}
