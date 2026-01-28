import { Injectable } from "@angular/core";

import { FlightRecorderClient } from "@bitwarden/sdk-internal";

import { FlightRecorderLogData } from "./flight-recorder-log-data";

/**
 * Service for exporting Flight Recorder logs.
 * Wraps the WASM FlightRecorderClient for Angular DI.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderService {
  private client: FlightRecorderClient;

  constructor() {
    // FlightRecorderClient accesses the global buffer initialized by init_sdk()
    this.client = new FlightRecorderClient();
  }

  /**
   * Drain all events from the SDK buffer and return them.
   * WARNING: This empties the buffer - events are only returned once.
   */
  drain(): FlightRecorderLogData[] {
    return this.client.drain();
  }

  /**
   * Get current event count without draining.
   */
  count(): number {
    return this.client.count();
  }

  /**
   * Export logs as formatted JSON string for download.
   */
  exportAsJson(): string {
    const events = this.drain();
    return JSON.stringify(events, null, 2);
  }

  /**
   * Export logs as plain text for download.
   */
  exportAsPlainText(): string {
    const events = this.drain();
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
