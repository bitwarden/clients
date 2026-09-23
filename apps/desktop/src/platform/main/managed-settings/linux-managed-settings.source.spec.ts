import { constants, existsSync, readFileSync, watch } from "node:fs";
import { open } from "node:fs/promises";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { LinuxManagedSettingsSource } from "./linux-managed-settings.source";

jest.mock("node:fs/promises", () => ({
  open: jest.fn(),
}));

jest.mock("node:fs", () => ({
  ...jest.requireActual("node:fs"),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  watch: jest.fn(),
}));

const openMock = open as jest.Mock;
const watchMock = watch as unknown as jest.Mock;
const existsSyncMock = existsSync as unknown as jest.Mock;
const readFileSyncMock = readFileSync as unknown as jest.Mock;

const OVERFLOW_UID = 65534;

/** Paths `existsSync` reports as present. */
let existing: Set<string>;

/** Stands in for the FSWatcher `fs.watch` returns, capturing its listeners for the test to fire. */
function fakeWatcher() {
  const listeners = new Map<string, (arg: unknown) => void>();
  return {
    on: jest.fn((event: string, listener: (arg: unknown) => void) => {
      listeners.set(event, listener);
    }),
    close: jest.fn(),
    emit: (event: string, arg: unknown) => listeners.get(event)?.(arg),
  };
}

const PRIMARY = "/etc/bitwarden/managed-settings.json";
const FALLBACK = "/run/host/etc/bitwarden/managed-settings.json";

function fakeHandle(
  overrides: Partial<{ isFile: boolean; uid: number; mode: number }> = {},
  contents = "",
) {
  return {
    stat: jest.fn().mockResolvedValue({
      isFile: () => overrides.isFile ?? true,
      uid: overrides.uid ?? 0,
      mode: overrides.mode ?? 0o644,
    }),
    readFile: jest.fn().mockResolvedValue(contents),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

function errnoError(code: string): NodeJS.ErrnoException {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

describe("LinuxManagedSettingsSource", () => {
  let logService: LogService;
  let source: LinuxManagedSettingsSource;

  beforeEach(() => {
    existing = new Set(["/etc/bitwarden", "/run/host/etc/bitwarden", "/etc", "/run/host/etc"]);
    existsSyncMock.mockImplementation((p: string) => existing.has(p));
    readFileSyncMock.mockReturnValue(`${OVERFLOW_UID}\n`);
    logService = mock<LogService>();
    source = new LinuxManagedSettingsSource(logService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("reads a regular, root-owned, non-group/other-writable file", async () => {
    const handle = fakeHandle({}, '{"a":1}');
    openMock.mockResolvedValueOnce(handle);

    const result = await source.read();

    expect(result).toBe('{"a":1}');
    expect(openMock).toHaveBeenCalledWith(
      PRIMARY,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  });

  it("rejects a symlink candidate, logs it, and tries the next candidate", async () => {
    openMock.mockRejectedValueOnce(errnoError("ELOOP"));
    const handle = fakeHandle({}, "fallback-contents");
    openMock.mockResolvedValueOnce(handle);

    const result = await source.read();

    expect(result).toBe("fallback-contents");
    expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining(PRIMARY));
    expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("symlink"));
    expect(openMock).toHaveBeenNthCalledWith(2, FALLBACK, expect.any(Number));
  });

  it("rejects a non-regular file", async () => {
    const handle = fakeHandle({ isFile: false });
    openMock.mockResolvedValueOnce(handle);
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));

    const result = await source.read();

    expect(result).toBeUndefined();
    expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("not a regular file"));
  });

  it("rejects a file not owned by root", async () => {
    const handle = fakeHandle({ uid: 1000 });
    openMock.mockResolvedValueOnce(handle);
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));

    const result = await source.read();

    expect(result).toBeUndefined();
    expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("not owned by root"));
  });

  it("rejects a group-writable file", async () => {
    const handle = fakeHandle({ mode: 0o664 });
    openMock.mockResolvedValueOnce(handle);
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));

    const result = await source.read();

    expect(result).toBeUndefined();
    expect(logService.warning).toHaveBeenCalledWith(
      expect.stringContaining("writable by group or other"),
    );
  });

  it("rejects a world-writable file", async () => {
    const handle = fakeHandle({ mode: 0o666 });
    openMock.mockResolvedValueOnce(handle);
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));

    const result = await source.read();

    expect(result).toBeUndefined();
    expect(logService.warning).toHaveBeenCalledWith(
      expect.stringContaining("writable by group or other"),
    );
  });

  it("falls through an ENOENT on the first candidate without logging a warning", async () => {
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));
    const handle = fakeHandle({}, "fallback-contents");
    openMock.mockResolvedValueOnce(handle);

    const result = await source.read();

    expect(result).toBe("fallback-contents");
    expect(logService.warning).not.toHaveBeenCalled();
  });

  it("opens a candidate exactly once, reading the stat and the contents through that same handle", async () => {
    const handle = fakeHandle({}, "contents");
    openMock.mockResolvedValueOnce(handle);

    await source.read();

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(handle.stat).toHaveBeenCalledTimes(1);
    expect(handle.readFile).toHaveBeenCalledTimes(1);
  });

  it("closes the handle when a candidate is rejected by a check", async () => {
    const handle = fakeHandle({ isFile: false });
    openMock.mockResolvedValueOnce(handle);
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));

    await source.read();

    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("closes the handle after a successful read", async () => {
    const handle = fakeHandle({}, "contents");
    openMock.mockResolvedValueOnce(handle);

    await source.read();

    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when no candidate passes", async () => {
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));

    const result = await source.read();

    expect(result).toBeUndefined();
  });

  it("rejects an unreadable candidate, logs it, and tries the next candidate", async () => {
    openMock.mockRejectedValueOnce(errnoError("EACCES"));
    openMock.mockResolvedValueOnce(fakeHandle({}, "fallback-contents"));

    const result = await source.read();

    expect(result).toBe("fallback-contents");
    expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("EACCES"));
  });

  describe("inside Flatpak", () => {
    beforeEach(() => {
      existing.add("/.flatpak-info");
      source = new LinuxManagedSettingsSource(logService);
    });

    it("accepts a candidate owned by the overflow uid", async () => {
      openMock.mockResolvedValueOnce(fakeHandle({ uid: OVERFLOW_UID }, "contents"));

      expect(await source.read()).toBe("contents");
    });

    it("rejects a candidate owned by the process's own uid", async () => {
      jest.spyOn(process, "getuid").mockReturnValue(OVERFLOW_UID);
      source = new LinuxManagedSettingsSource(logService);
      openMock.mockResolvedValueOnce(fakeHandle({ uid: OVERFLOW_UID }));
      openMock.mockRejectedValueOnce(errnoError("ENOENT"));

      expect(await source.read()).toBeUndefined();
      expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("not owned by root"));
    });
  });

  it("rejects a candidate owned by the overflow uid outside Flatpak", async () => {
    openMock.mockResolvedValueOnce(fakeHandle({ uid: OVERFLOW_UID }));
    openMock.mockRejectedValueOnce(errnoError("ENOENT"));

    expect(await source.read()).toBeUndefined();
    expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("not owned by root"));
  });

  describe("watch", () => {
    it("watches each candidate's containing directory rather than the file", async () => {
      watchMock.mockReturnValue(fakeWatcher());

      await source.watch(() => undefined);

      expect(watchMock).toHaveBeenCalledWith("/etc/bitwarden", expect.any(Function));
      expect(watchMock).toHaveBeenCalledWith("/run/host/etc/bitwarden", expect.any(Function));
    });

    it("invokes onChanged when the changed entry is the managed settings file", async () => {
      const watcher = fakeWatcher();
      watchMock.mockReturnValue(watcher);
      const onChanged = jest.fn();

      await source.watch(onChanged);
      watchMock.mock.calls[0][1]("change", "managed-settings.json");

      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("ignores a change to an unrelated entry in the watched directory", async () => {
      watchMock.mockReturnValue(fakeWatcher());
      const onChanged = jest.fn();

      await source.watch(onChanged);
      watchMock.mock.calls[0][1]("change", "something-else.json");

      expect(onChanged).not.toHaveBeenCalled();
    });

    it("carries on when neither a candidate's directory nor its parent can be watched", async () => {
      existing = new Set(["/etc/bitwarden"]);
      watchMock.mockReturnValueOnce(fakeWatcher());
      watchMock.mockImplementationOnce(() => {
        throw errnoError("ENOENT");
      });

      await expect(source.watch(() => undefined)).resolves.toBeUndefined();
      expect(watchMock).toHaveBeenCalledTimes(2);
      expect(logService.info).toHaveBeenCalledWith(
        expect.stringContaining("/run/host/etc"),
        expect.anything(),
      );
    });

    it("watches the parent while the bitwarden directory is missing", async () => {
      existing.delete("/etc/bitwarden");
      watchMock.mockReturnValue(fakeWatcher());

      await source.watch(() => undefined);

      expect(watchMock).toHaveBeenCalledWith("/etc", expect.any(Function));
      expect(watchMock).not.toHaveBeenCalledWith("/etc/bitwarden", expect.any(Function));
    });

    it("moves the watch to the bitwarden directory once it is created, and signals a change", async () => {
      existing.delete("/etc/bitwarden");
      const parentWatcher = fakeWatcher();
      watchMock.mockReturnValue(fakeWatcher());
      watchMock.mockReturnValueOnce(parentWatcher);
      const onChanged = jest.fn();

      await source.watch(onChanged);
      existing.add("/etc/bitwarden");
      watchMock.mock.calls[0][1]("rename", "bitwarden");

      expect(parentWatcher.close).toHaveBeenCalled();
      expect(watchMock).toHaveBeenCalledWith("/etc/bitwarden", expect.any(Function));
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("ignores unrelated changes in the parent while the bitwarden directory is missing", async () => {
      existing.delete("/etc/bitwarden");
      watchMock.mockReturnValue(fakeWatcher());
      const onChanged = jest.fn();

      await source.watch(onChanged);
      watchMock.mock.calls[0][1]("change", "hosts");

      expect(onChanged).not.toHaveBeenCalled();
    });

    it("moves the watch back to the parent when the bitwarden directory is removed", async () => {
      const dirWatcher = fakeWatcher();
      watchMock.mockReturnValue(fakeWatcher());
      watchMock.mockReturnValueOnce(dirWatcher);
      const onChanged = jest.fn();

      await source.watch(onChanged);
      existing.delete("/etc/bitwarden");
      watchMock.mock.calls[0][1]("rename", "bitwarden");

      expect(dirWatcher.close).toHaveBeenCalled();
      expect(watchMock).toHaveBeenCalledWith("/etc", expect.any(Function));
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("re-resolves when the bitwarden directory is removed between the existence check and the watch", async () => {
      watchMock.mockImplementationOnce(() => {
        existing.delete("/etc/bitwarden");
        throw errnoError("ENOENT");
      });
      watchMock.mockReturnValue(fakeWatcher());
      const onChanged = jest.fn();

      await source.watch(onChanged);

      expect(watchMock).toHaveBeenNthCalledWith(2, "/etc", expect.any(Function));
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("re-resolves when the bitwarden directory is created between the existence check and the watch", async () => {
      existing.delete("/etc/bitwarden");
      const parentWatcher = fakeWatcher();
      watchMock.mockReturnValue(fakeWatcher());
      watchMock.mockImplementationOnce(() => {
        existing.add("/etc/bitwarden");
        return parentWatcher;
      });
      const onChanged = jest.fn();

      await source.watch(onChanged);

      expect(parentWatcher.close).toHaveBeenCalled();
      expect(watchMock).toHaveBeenNthCalledWith(2, "/etc/bitwarden", expect.any(Function));
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("logs and closes the watcher on an error event rather than letting it throw", async () => {
      const watcher = fakeWatcher();
      watchMock.mockReturnValue(watcher);

      await source.watch(() => undefined);
      watcher.emit("error", new Error("directory removed"));

      expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("directory removed"));
      expect(watcher.close).toHaveBeenCalled();
    });
  });
});
