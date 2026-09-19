/** Additional key/value pairs surfaced on the devtools track entry. */
export type EventProperties = [string, any][];

/**
 * Identifies a single performance event.
 *
 * The three names form a hierarchy in the devtools performance panel:
 * `namespace` is the track group, `category` is the track, and `name` labels the entry itself.
 *
 * ```
 * Locking                   <- namespace
 *  └─ Unlock                <- category
 *      └─ unlockWithPin     <- name
 * ```
 */
export type PerformanceEventDescriptor = {
  /** A track group, should generally be the team owning the domain. */
  namespace: string;
  /** A track, should generally be the class name. */
  category: string;
  /** A descriptive name for the event. */
  name: string;
  properties?: EventProperties;
};

/**
 * A timed event started by {@link PerformanceTrackingService.startEvent}. The measurement is written
 * to the performance timeline when {@link finish} is called.
 */
export abstract class PerformanceEvent {
  /**
   * Records an intermediate mark on the event's timeline.
   *
   * @param name Name of the mark, scoped to this event.
   */
  abstract mark(name: string): void;

  /**
   * Writes the measurement spanning from the event's start until now. Calling this more than once
   * has no further effect.
   *
   * @param properties Additional properties, merged with the ones given at start.
   */
  abstract finish(properties?: EventProperties): void;
}
