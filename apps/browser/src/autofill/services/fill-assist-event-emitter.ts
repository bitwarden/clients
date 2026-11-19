import { FillAssistEventName, type FillAssistMissReason } from "../background/fill-assist-event";
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
  qualificationFailed(domain: string, missReason: FillAssistMissReason): void {
    void sendExtensionMessage("fillAssistEmit", {
      name: FillAssistEventName.QualificationFailed,
      payload: {
        domain,
        missReason,
        // FIXME (PM-34713): finalize the shape of the ruleId value during fill assist M6
        ruleId: "0",
      },
    }).catch(() => {
      // Dropped telemetry is acceptable. The qualification path continues.
    });
  }
}
