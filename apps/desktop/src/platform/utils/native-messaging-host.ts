import type { OutgoingMessage } from "@bitwarden/sdk-internal";

export type NativeMessagingHost = { id: string | { Id: number } };

/**
 * The host of a destination reached over native messaging, or `undefined` for one that is not.
 *
 * Shared by the main process and the renderer, so both route the same destinations.
 */
export function nativeMessagingHost(
  destination: OutgoingMessage["destination"],
): NativeMessagingHost | undefined {
  if (typeof destination !== "object") {
    return undefined;
  }

  if ("BrowserBackground" in destination) {
    return destination.BrowserBackground;
  }

  if ("Cli" in destination) {
    return (destination as { Cli: NativeMessagingHost }).Cli;
  }

  return undefined;
}
