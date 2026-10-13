import { FlightRecorder } from "@bitwarden/logging";

import { AutomationCapability } from "../automation-capability";

/** Reads SDK flight recorder events. Only wired on clients with the WASM SDK. */
export class LoggingCapability extends AutomationCapability {
  readonly automationName = "logging";

  constructor(private flightRecorder: FlightRecorder) {
    super();
  }

  /** Read all events currently in the flight recorder buffer. */
  async readEvents() {
    return await this.flightRecorder.read();
  }

  /** Number of events in the flight recorder buffer, without reading their contents. */
  async countEvents(): Promise<number> {
    return await this.flightRecorder.count();
  }
}
