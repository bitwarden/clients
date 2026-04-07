/**
 * Wrapper service around window.location for testability.
 * jsdom cannot mock window.location directly, so this service provides mockable methods.
 */
export class LocationService {
  /**
   * Get the current page href
   */
  getHref(): string {
    return globalThis.location.href;
  }

  /**
   * Get the current hostname
   */
  getHostname(): string {
    return globalThis.location.hostname;
  }

  /**
   * Get the current protocol
   */
  getProtocol(): string {
    return globalThis.location.protocol;
  }

  /**
   * Set the location href (navigate)
   */
  setHref(url: string): void {
    globalThis.location.href = url;
  }

  /**
   * Reload the current page
   */
  reload(): void {
    globalThis.location.reload();
  }
}
