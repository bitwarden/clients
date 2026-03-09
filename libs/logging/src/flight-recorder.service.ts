import { Injectable } from "@angular/core";

import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { FlightRecorderClient, FlightRecorderEvent } from "@bitwarden/sdk-internal";

/**
 * Type alias for FlightRecorderEvent from SDK.
 * Provides backwards compatibility for existing code using FlightRecorderLogData.
 */
export type FlightRecorderLogData = FlightRecorderEvent;

/**
 * Service for exporting Flight Recorder logs.
 * Wraps the WASM FlightRecorderClient for Angular DI.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderService {
  private clientPromise: Promise<FlightRecorderClient> | null = null;

  constructor() {
    // Empty - initialization deferred until first use
  }

  private async ensureClient(): Promise<FlightRecorderClient> {
    if (this.clientPromise === null) {
      this.clientPromise = SdkLoadService.Ready.then(() => new FlightRecorderClient());
    }
    return this.clientPromise;
  }

  /**
   * Read all events from the SDK buffer and return them.
   * WARNING: This empties the buffer - events are only returned once.
   */
  async read(): Promise<FlightRecorderLogData[]> {
    const client = await this.ensureClient();
    return client.drain();
  }

  /**
   * Get current event count without draining.
   */
  async count(): Promise<number> {
    const client = await this.ensureClient();
    return client.count();
  }

  /**
   * Export logs as formatted JSON string for download.
   */
  async exportAsJson(): Promise<string> {
    const events = await this.read();
    return JSON.stringify(events, null, 2);
  }

  /**
   * Export logs as plain text for download.
   */
  async exportAsPlainText(): Promise<string> {
    const events = await this.read();
    return events
      .map((e) => {
        const fieldsStr = Object.entries(e.fields)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ");
        const fieldsSuffix = fieldsStr ? ` [${fieldsStr}]` : "";
        return `[${new Date(e.timestamp).toISOString()}] ${e.level.toUpperCase()} ${e.target}: ${e.message}${fieldsSuffix}`;
      })
      .join("\n");
  }
}
