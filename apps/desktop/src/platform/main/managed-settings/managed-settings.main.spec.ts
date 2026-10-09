import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, defer, throwError } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { ManagedSettingsClient } from "@bitwarden/sdk-internal";

import { ManagedSettingsSource } from "./managed-settings-source";
import { ManagedSettingsMain } from "./managed-settings.main";

class FakeSource extends ManagedSettingsSource {
  readonly location = "test location";
  read = jest.fn<Promise<string | undefined>, []>();
  watch = jest.fn<Promise<void>, [() => void]>().mockResolvedValue(undefined);

  /** Fires the change signal registered through {@link watch}. */
  signal(): void {
    this.watch.mock.calls[0][0]();
  }
}

/** Settles every queued refresh. Each refresh chains several promises. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe("ManagedSettingsMain", () => {
  let source: FakeSource;
  let client: MockProxy<ManagedSettingsClient>;
  let managedSettingsService: MockProxy<ManagedSettingsService>;
  let logService: MockProxy<LogService>;
  let sut: ManagedSettingsMain;

  beforeEach(() => {
    source = new FakeSource();
    client = mock<ManagedSettingsClient>();
    client.update_from_json.mockResolvedValue(undefined);
    // Assigned after construction; see mockManagedSettingsService in @bitwarden/common/spec.
    managedSettingsService = mock<ManagedSettingsService>();
    managedSettingsService.client$ = new BehaviorSubject(client);
    logService = mock<LogService>();
    sut = new ManagedSettingsMain(source, managedSettingsService, logService);
  });

  it("logs and returns when the platform has no source", async () => {
    sut = new ManagedSettingsMain(undefined, managedSettingsService, logService);

    await sut.init();

    expect(logService.info).toHaveBeenCalledWith(
      expect.stringContaining("Managed settings: no source for platform"),
    );
    expect(client.update_from_json).not.toHaveBeenCalled();
  });

  it("passes the container value read at startup to the client unchanged", async () => {
    source.read.mockResolvedValue('{"environment":{"base":"https://vault.example.com"}}');

    await sut.init();

    expect(client.update_from_json).toHaveBeenCalledWith(
      '{"environment":{"base":"https://vault.example.com"}}',
    );
    expect(logService.info).toHaveBeenCalledWith("Managed settings: watching test location.");
  });

  it("clears the profile when the read returns undefined", async () => {
    source.read.mockResolvedValue(undefined);

    await sut.init();

    expect(client.update_from_json).toHaveBeenCalledWith(undefined);
    expect(logService.info).toHaveBeenCalledWith("Managed settings: test location holds no value.");
  });

  it("logs the rejection reason when the client rejects the value", async () => {
    const rejection = new Error("top level is not an object");
    source.read.mockResolvedValue("[1, 2]");
    client.update_from_json.mockRejectedValue(rejection);

    await sut.init();

    expect(logService.error).toHaveBeenCalledWith(
      "Managed settings: the value in test location was rejected.",
      rejection,
    );
  });

  it("keeps the last known profile and logs the location when a read throws", async () => {
    source.read.mockResolvedValueOnce('{"a":1}');
    await sut.init();
    client.update_from_json.mockClear();
    const failure = new Error("access denied");
    source.read.mockRejectedValueOnce(failure);

    source.signal();
    await flush();

    expect(client.update_from_json).not.toHaveBeenCalled();
    expect(logService.warning).toHaveBeenCalledWith(
      "Managed settings: could not read test location, keeping the last known profile.",
      failure,
    );
  });

  it("re-reads on a watcher signal and skips the update when the value is unchanged", async () => {
    source.read.mockResolvedValue('{"a":1}');
    await sut.init();

    source.signal();
    await flush();

    expect(source.read).toHaveBeenCalledTimes(2);
    expect(client.update_from_json).toHaveBeenCalledTimes(1);
  });

  it("applies a changed value on a watcher signal", async () => {
    source.read.mockResolvedValueOnce('{"a":1}').mockResolvedValueOnce('{"a":2}');
    await sut.init();

    source.signal();
    await flush();

    expect(client.update_from_json).toHaveBeenLastCalledWith('{"a":2}');
  });

  it("runs overlapping reads one at a time so the last read wins", async () => {
    source.read.mockResolvedValueOnce(undefined);
    await sut.init();

    let resolveSlow: (value: string) => void = () => {};
    let inFlight = 0;
    let maxInFlight = 0;
    const track = <T>(promise: Promise<T>): Promise<T> => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return promise.finally(() => inFlight--);
    };
    source.read
      .mockImplementationOnce(() => track(new Promise((resolve) => (resolveSlow = resolve))))
      .mockImplementationOnce(() => track(Promise.resolve('{"v":"fast"}')));

    source.signal();
    source.signal();
    await flush();
    resolveSlow('{"v":"slow"}');
    await flush();

    expect(maxInFlight).toBe(1);
    expect(client.update_from_json).toHaveBeenLastCalledWith('{"v":"fast"}');
  });

  it("logs an unexpected refresh failure and applies the value on a later signal", async () => {
    source.read.mockResolvedValue('{"a":1}');
    const failure = new Error("sdk not loaded");
    // The first subscription to client$ errors, so the refresh fails before the value is recorded.
    let failNext = true;
    managedSettingsService.client$ = defer(() => {
      if (failNext) {
        failNext = false;
        return throwError(() => failure);
      }
      return new BehaviorSubject(client);
    });

    await sut.init();
    expect(logService.error).toHaveBeenCalledWith("Managed settings: refresh failed.", failure);
    expect(client.update_from_json).not.toHaveBeenCalled();

    source.signal();
    await flush();

    expect(client.update_from_json).toHaveBeenCalledWith('{"a":1}');
  });

  it("logs a watcher that fails to start", async () => {
    source.read.mockResolvedValue(undefined);
    const failure = new Error("no ancestor");
    source.watch.mockRejectedValue(failure);

    await sut.init();

    expect(logService.error).toHaveBeenCalledWith(
      "Managed settings: failed to watch test location.",
      failure,
    );
  });
});
