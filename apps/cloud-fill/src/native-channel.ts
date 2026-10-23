import type { FillResult } from "./messages";
import { pairWithToken } from "./relay-credential-source";

const HOST_NAME = "com.bitwarden.cloudfill";
const RETRY_DELAY_MS = 2_000;

type HostRequest =
  | { id: number; type: "fill" }
  | { id: number; type: "pair"; pskToken: string; relayUrl?: string };

export type Handlers = {
  fill: () => Promise<FillResult>;
  defaultRelayUrl: string;
  allowInsecureLocal: boolean;
};

/**
 * The harness trigger channel. Only the native messaging host that Chrome launches for this
 * extension id can send on this port; pages, the agent and other extensions have no route to it.
 * Replies carry a status only.
 */
export function startNativeChannel(handlers: Handlers): void {
  const connect = () => {
    const port = chrome.runtime.connectNative(HOST_NAME);

    port.onMessage.addListener(async (message: HostRequest) => {
      if (typeof message?.id !== "number") {
        return;
      }

      if (message.type === "fill") {
        port.postMessage({ id: message.id, result: await handlers.fill() });
        return;
      }

      if (message.type === "pair") {
        try {
          await pairWithToken(
            message.pskToken,
            message.relayUrl ?? handlers.defaultRelayUrl,
            handlers.allowInsecureLocal,
          );
          port.postMessage({ id: message.id, result: { status: "ok" } });
        } catch {
          port.postMessage({ id: message.id, result: { status: "relay_error" } });
        }
      }
    });

    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      setTimeout(connect, RETRY_DELAY_MS);
    });
  };

  connect();
}
