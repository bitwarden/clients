import {
  PerformanceEvent as SdkPerformanceEvent,
  logPerformanceEvent,
  logPerformanceMark,
  startPerformanceEvent,
} from "@bitwarden/sdk-internal";

import { EventProperties, PerformanceEvent, PerformanceEventDescriptor } from "./performance-event";
import { PerformanceTrackingService } from "./performance-tracking.service";

/**
 * Draws entries through the SDK's `bitwarden-performance-tracking` crate, so an entry written by a
 * client and one written inside the SDK read the same on the devtools timeline.
 */
export class DefaultPerformanceTrackingService implements PerformanceTrackingService {
  mark(name: string): void {
    whenLoaded(() => logPerformanceMark(name));
  }

  startEvent(descriptor: PerformanceEventDescriptor): PerformanceEvent {
    const { namespace, category, name, properties } = descriptor;

    return new SdkScopedEvent(
      whenLoaded(() => startPerformanceEvent(namespace, category, name, properties)),
    );
  }

  logEvent(descriptor: PerformanceEventDescriptor): void {
    const { namespace, category, name, properties } = descriptor;

    whenLoaded(() => logPerformanceEvent(namespace, category, name, properties));
  }
}

/** Event bound to the SDK handle `startEvent` created, if the SDK was loaded at the time. */
class SdkScopedEvent extends PerformanceEvent {
  constructor(private event?: SdkPerformanceEvent) {
    super();
  }

  mark(name: string): void {
    whenLoaded(() => this.event?.mark(name));
  }

  finish(properties?: EventProperties): void {
    const event = this.event;
    if (event == null) {
      return;
    }

    // `finish` consumes the handle on the Rust side, so a second call would fault on a freed
    // pointer rather than write a second entry.
    this.event = undefined;

    whenLoaded(() => event.finish(properties));
  }
}

/**
 * Runs `call` if the SDK's WASM module is initialized, and drops the event if it is not.
 *
 * Performance tracking is wired up long before `SdkLoadService` has run, and calling into an
 * uninitialized module throws. Tracking is a debugging aid, so a dropped entry is always preferable
 * to an exception escaping into the operation being measured.
 */
function whenLoaded<T>(call: () => T): T | undefined {
  try {
    return call();
  } catch {
    return undefined;
  }
}
