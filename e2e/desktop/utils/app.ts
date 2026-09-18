import { AttachedApp, attachOverCdp } from "../../utils/cdp";

// `npm run debug:desktop` launches Electron with --remote-debugging-port=9222.
const DEBUG_PORT = 9222;
const RENDERER_URL_PREFIX = "file://";
const START_COMMAND = "npm run test:e2e:desktop";

/** Attaches to the running desktop app and returns its renderer page. */
export function attachToDesktop(): Promise<AttachedApp> {
  return attachOverCdp({
    port: DEBUG_PORT,
    urlPrefix: RENDERER_URL_PREFIX,
    startCommand: START_COMMAND,
  });
}
