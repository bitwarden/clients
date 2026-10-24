import type { FillResult } from "./messages";
import { pairWithToken } from "./relay-credential-source";
import { loadPairing } from "./session-storage";

const HOST_NAME = "com.bitwarden.cloudfill";
const RETRY_DELAY_MS = 2_000;
const RECONNECT_ALARM = "cloudFillNativeReconnect";

type HostRequest =
  | { id: number; type: "fill"; expectedOrigin?: string }
  | { id: number; type: "pair"; pskToken: string; relayUrl?: string; replace?: boolean };

export type Handlers = {
  fill: (expectedOrigin?: string) => Promise<FillResult>;
  defaultRelayUrl: string;
  allowInsecureLocal: boolean;
};

export function startNativeChannel(handlers: Handlers): void {
  let connected = false;

  const connect = () => {
    if (connected) {
      return;
    }
    connected = true;
    const port = chrome.runtime.connectNative(HOST_NAME);

    port.onMessage.addListener(async (message: HostRequest) => {
      if (typeof message?.id !== "number") {
        return;
      }

      if (message.type === "fill") {
        const expectedOrigin =
          typeof message.expectedOrigin === "string" ? message.expectedOrigin : undefined;
        port.postMessage({ id: message.id, result: await handlers.fill(expectedOrigin) });
        return;
      }

      if (message.type === "pair") {
        if (message.replace !== true && (await loadPairing()) != null) {
          port.postMessage({ id: message.id, result: { status: "error" } });
          return;
        }
        // The relay is fixed at build time; only test builds may point somewhere else.
        const relayUrl = handlers.allowInsecureLocal
          ? (message.relayUrl ?? handlers.defaultRelayUrl)
          : handlers.defaultRelayUrl;
        try {
          await pairWithToken(message.pskToken, relayUrl, handlers.allowInsecureLocal);
          port.postMessage({ id: message.id, result: { status: "ok" } });
        } catch {
          port.postMessage({ id: message.id, result: { status: "relay_error" } });
        }
      }
    });

    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      connected = false;
      setTimeout(connect, RETRY_DELAY_MS);
    });
  };

  void chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RECONNECT_ALARM) {
      connect();
    }
  });

  connect();
}
