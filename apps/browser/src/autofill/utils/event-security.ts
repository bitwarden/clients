/**
 * Event security utilities for validating trusted events
 */
export class EventSecurity {
  /**
   * Validates that an event is trusted (originated from user agent)
   * @param event - The event to validate
   * @returns true if the event is trusted, false otherwise
   */
  static isEventTrusted(event: Event): boolean {
    return event.isTrusted;
  }
}
