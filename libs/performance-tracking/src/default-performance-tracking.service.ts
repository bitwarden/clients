import { EventProperties, PerformanceEvent, PerformanceEventDescriptor } from "./performance-event";
import { PerformanceLogSink } from "./performance-log-sink";
import { PerformanceTrackingService } from "./performance-tracking.service";

/**
 * Nominal duration given to `logEvent` entries. A zero-length entry cannot be clicked in the
 * devtools performance panel, so point-in-time events are widened to stay selectable.
 */
export const INSTANT_EVENT_DURATION_MS = 50;

/** Property flagging an entry whose duration is nominal rather than measured. */
export const INSTANT_EVENT_PROPERTY = "instant";

const DEVTOOLS_TRACK_ENTRY = "track-entry";
const DEVTOOLS_MARKER = "marker";

export class DefaultPerformanceTrackingService implements PerformanceTrackingService {
  constructor(private readonly log: PerformanceLogSink = () => {}) {}

  measure(
    start: DOMHighResTimeStamp,
    trackGroup: string,
    track: string,
    name?: string,
    properties?: EventProperties,
  ): PerformanceMeasure {
    return this.writeMeasure(start, performance.now(), trackGroup, track, name, properties);
  }

  mark(name: string): PerformanceMark {
    const mark = performance.mark(name, {
      detail: {
        devtools: {
          dataType: DEVTOOLS_MARKER,
        },
      },
    });

    this.log(mark.name, new Date().toISOString());

    return mark;
  }

  startEvent(descriptor: PerformanceEventDescriptor): PerformanceEvent {
    return new ScopedPerformanceEvent(this, descriptor, performance.now());
  }

  logEvent(descriptor: PerformanceEventDescriptor): PerformanceMeasure {
    const start = performance.now();
    const properties: EventProperties = [
      ...(descriptor.properties ?? []),
      [INSTANT_EVENT_PROPERTY, true],
    ];

    return this.writeMeasure(
      start,
      start + INSTANT_EVENT_DURATION_MS,
      descriptor.namespace,
      descriptor.category,
      descriptor.name,
      properties,
    );
  }

  /** Single `performance.measure` call site shared by `measure` and `logEvent`. */
  private writeMeasure(
    start: DOMHighResTimeStamp,
    end: DOMHighResTimeStamp,
    trackGroup: string,
    track: string,
    name?: string,
    properties?: EventProperties,
  ): PerformanceMeasure {
    const measureName = `[${track}]: ${name}`;

    const measure = performance.measure(measureName, {
      start,
      end,
      detail: {
        devtools: {
          dataType: DEVTOOLS_TRACK_ENTRY,
          track,
          trackGroup,
          properties,
        },
      },
    });

    this.log(`${measureName} took ${measure.duration}`, properties);

    return measure;
  }
}

/** Event bound to the descriptor and start time captured by `startEvent`. */
class ScopedPerformanceEvent extends PerformanceEvent {
  private measure: PerformanceMeasure | null = null;

  constructor(
    private readonly tracking: DefaultPerformanceTrackingService,
    private readonly descriptor: PerformanceEventDescriptor,
    private readonly start: DOMHighResTimeStamp,
  ) {
    super();
  }

  mark(name: string): PerformanceMark {
    const { category, name: eventName } = this.descriptor;

    return this.tracking.mark(`[${category}] ${eventName}: ${name}`);
  }

  finish(properties?: EventProperties): PerformanceMeasure {
    if (this.measure != null) {
      return this.measure;
    }

    const { namespace, category, name } = this.descriptor;
    const merged = [...(this.descriptor.properties ?? []), ...(properties ?? [])];

    this.measure = this.tracking.measure(this.start, namespace, category, name, merged);

    return this.measure;
  }
}
