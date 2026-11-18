import type { FillAssistEvent } from "../background/fill-assist-event-receiver";
import { sendExtensionMessage } from "../utils";

import { FillAssistEventEmitter } from "./abstractions/fill-assist-event-emitter";

/**
 * Content-script implementation of `FillAssistEventEmitter`. Fires a
 * `fillAssistEmit` message into the background pipeline, where the receiver
 * registered in `main.background.ts` handles it. Best effort: the emitter
 * does not await the dispatch, and rejections are dropped so a failed
 * telemetry step cannot break the qualification path.
 */
export class DefaultFillAssistEventEmitter implements FillAssistEventEmitter {
  emit(event: FillAssistEvent): void {
    void sendExtensionMessage("fillAssistEmit", event).catch(() => {
      // Dropped telemetry is acceptable. The qualification path continues.
    });
  }
}
