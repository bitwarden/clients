import { type FlightRecorderClient, LogLevel as SdkLogLevel } from "@bitwarden/sdk-internal";

import { LogLevel } from "./log-level";
import { LogRecorder } from "./log-recorder";
import { safeStringify } from "./safe-stringify";

/** Cap on records buffered before the SDK is ready. Later records are dropped. */
const MAX_QUEUE = 1000;

/**
 * The SDK carries a `Trace` level the clients have no equivalent for.
 *
 * Read at call time: `libs/common` re-exports the `@bitwarden/logging` barrel, so touching
 * the SDK enum during module evaluation breaks every spec that stubs
 * `@bitwarden/sdk-internal` with a partial mock.
 */
function toSdkLevel(level: LogLevel): SdkLogLevel {
  switch (level) {
    case LogLevel.Debug:
      return SdkLogLevel.Debug;
    case LogLevel.Info:
      return SdkLogLevel.Info;
    case LogLevel.Warning:
      return SdkLogLevel.Warn;
    case LogLevel.Error:
      return SdkLogLevel.Error;
  }
}

interface QueuedRecord {
  timestamp: number;
  level: SdkLogLevel;
  message: string;
}

/**
 * A {@link LogRecorder} that forwards log events into the SDK Flight Recorder buffer.
 *
 * The buffer lives in WASM, which loads asynchronously, so records emitted before
 * the client resolves are held in a bounded in-memory queue and replayed in order
 * once it does. Timestamps are captured when the event is recorded, not when it is
 * written, so replayed records keep their original ordering.
 */
export class FlightRecorderLogRecorder implements LogRecorder {
  private client: FlightRecorderClient | null = null;
  private queue: QueuedRecord[] = [];
  private accepting = true;

  /**
   * @param clientReady Resolves with the client once the SDK WASM is loaded. On
   *   rejection the queue is dropped and further records are discarded.
   * @param target The target recorded alongside each event, mirroring the Rust
   *   module path on SDK-origin events.
   */
  constructor(
    clientReady: Promise<FlightRecorderClient>,
    private readonly target = "typescript",
  ) {
    void clientReady.then(
      (client) => {
        this.client = client;
        this.flush();
      },
      () => {
        this.accepting = false;
        this.queue = [];
      },
    );
  }

  record(level: LogLevel, message?: any, ...optionalParams: any[]): void {
    try {
      const timestamp = Date.now();
      const sdkLevel = toSdkLevel(level);
      const text = this.format(message, optionalParams);

      if (this.client != null) {
        this.client.write(timestamp, sdkLevel, this.target, text);
      } else if (this.accepting && this.queue.length < MAX_QUEUE) {
        this.queue.push({ timestamp, level: sdkLevel, message: text });
      }
    } catch {
      // Ignore error
    }
  }

  private flush(): void {
    const queued = this.queue;
    this.queue = [];

    for (const record of queued) {
      try {
        this.client!.write(record.timestamp, record.level, this.target, record.message);
      } catch {
        // Ignore error
      }
    }
  }

  private format(message: any, params: any[]): string {
    return [message, ...params]
      .map(safeStringify)
      .filter((part) => part.length > 0)
      .join(" ");
  }
}
