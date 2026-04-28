import { FlightRecorderClient, FlightRecorderEvent } from "@bitwarden/sdk-internal";

/**
 * Framework-agnostic wrapper around the SDK's {@link FlightRecorderClient}.
 *
 * The underlying WASM must be loaded before the client can be used. Callers
 * provide a `sdkReady` promise (typically `SdkLoadService.Ready`) that resolves
 * once the SDK is initialized. The client is lazily created on first access.
 */
export class FlightRecorder {
  private clientPromise: Promise<FlightRecorderClient> | undefined;

  /**
   * @param sdkReady - A promise that resolves when the SDK WASM has been loaded
   *   and initialized. Pass `SdkLoadService.Ready` in DI-enabled contexts.
   */
  constructor(private readonly sdkReady: Promise<void>) {}

  /**
   * Read all events currently in the flight recorder buffer.
   */
  async read(): Promise<FlightRecorderEvent[]> {
    const client = await this.getClient();
    return client.read();
  }

  /**
   * Get the current event count without reading event contents.
   */
  async count(): Promise<number> {
    const client = await this.getClient();
    return client.count();
  }

  private getClient(): Promise<FlightRecorderClient> {
    if (this.clientPromise == null) {
      this.clientPromise = this.sdkReady.then(() => new FlightRecorderClient());
    }
    return this.clientPromise;
  }
}
