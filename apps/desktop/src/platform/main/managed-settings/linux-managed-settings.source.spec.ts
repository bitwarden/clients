import { constants, existsSync, readFileSync, watch } from "node:fs";
import { open } from "node:fs/promises";

import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { LinuxManagedSettingsSource } from "./linux-managed-settings.source";

jest.mock("node:fs", () => ({
  constants: jest.requireActual("node:fs").constants,
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  watch: jest.fn(),
}));

jest.mock("node:fs/promises", () => ({
  open: jest.fn(),
}));

const ETC_FILE = "/etc/bitwarden/managed-settings.json";
const FLATPAK_FILE = "/run/host/etc/bitwarden/managed-settings.json";
const OVERFLOW_UID = 65534;

function errno(code: string): NodeJS.ErrnoException {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

function fakeHandle(file: { isFile?: boolean; uid?: number; mode?: number; contents?: string }) {
  return {
    stat: jest.fn().mockResolvedValue({
      isFile: () => file.isFile ?? true,
      uid: file.uid ?? 0,
      mode: file.mode ?? 0o100644,
    }),
    readFile: jest.fn().mockResolvedValue(file.contents ?? "{}"),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

type FakeWatcher = {
  path: string;
  listener: (event: string, filename: string | null) => void;
  close: jest.Mock;
  on: jest.Mock;
};

describe("LinuxManagedSettingsSource", () => {
  let logService: MockProxy<LogService>;
  let existing: Set<string>;

  beforeEach(() => {
    logService = mock<LogService>();
    existing = new Set();
    jest.mocked(existsSync).mockImplementation((p) => existing.has(p as string));
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe("read", () => {
    function openReturns(files: Record<string, ReturnType<typeof fakeHandle> | string>) {
      jest.mocked(open).mockImplementation(async (p) => {
        const file = files[p as string];
        if (file === undefined) {
          throw errno("ENOENT");
        }
        if (typeof file === "string") {
          throw errno(file);
        }
        return file as any;
      });
    }

    it("returns the contents of a root-owned regular file that is not group or world writable", async () => {
      openReturns({ [ETC_FILE]: fakeHandle({ contents: '{"environment":{"base":"x"}}' }) });
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.read()).resolves.toBe('{"environment":{"base":"x"}}');
      expect(logService.warning).not.toHaveBeenCalled();
    });

    it("checks and reads through one descriptor from a single no-follow open", async () => {
      const handle = fakeHandle({ contents: "{}" });
      openReturns({ [ETC_FILE]: handle });
      const source = new LinuxManagedSettingsSource(logService);

      await source.read();

      expect(open).toHaveBeenCalledTimes(1);
      const [, flags] = jest.mocked(open).mock.calls[0];
      expect((flags as number) & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
      expect(handle.stat).toHaveBeenCalledTimes(1);
      expect(handle.readFile).toHaveBeenCalledTimes(1);
      expect(handle.close).toHaveBeenCalledTimes(1);
    });

    it("rejects and logs a symlink", async () => {
      openReturns({ [ETC_FILE]: "ELOOP" });
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.read()).resolves.toBeUndefined();
      expect(logService.warning).toHaveBeenCalledWith(
        `Managed settings: rejected ${ETC_FILE}, candidate is a symlink.`,
      );
    });

    it.each([
      [{ isFile: false }, "not a regular file"],
      [{ uid: 1000 }, "not owned by root"],
      [{ mode: 0o100664 }, "writable by group or other"],
      [{ mode: 0o100646 }, "writable by group or other"],
    ])("rejects and logs a candidate with %o", async (file, failure) => {
      const handle = fakeHandle(file);
      openReturns({ [ETC_FILE]: handle });
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.read()).resolves.toBeUndefined();
      expect(handle.readFile).not.toHaveBeenCalled();
      expect(handle.close).toHaveBeenCalled();
      expect(logService.warning).toHaveBeenCalledWith(
        `Managed settings: rejected ${ETC_FILE}, ${failure}.`,
      );
    });

    it("falls back to the /run/host/etc candidate without logging when /etc has none", async () => {
      openReturns({ [FLATPAK_FILE]: fakeHandle({ contents: '{"a":1}' }) });
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.read()).resolves.toBe('{"a":1}');
      expect(logService.warning).not.toHaveBeenCalled();
    });

    it("logs an EACCES open and advances to the next candidate", async () => {
      openReturns({ [ETC_FILE]: "EACCES", [FLATPAK_FILE]: fakeHandle({ contents: '{"a":1}' }) });
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.read()).resolves.toBe('{"a":1}');
      expect(logService.warning).toHaveBeenCalledWith(
        `Managed settings: rejected ${ETC_FILE}, open failed with EACCES.`,
      );
    });

    it("returns undefined without logging when no candidate exists", async () => {
      openReturns({});
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.read()).resolves.toBeUndefined();
      expect(logService.warning).not.toHaveBeenCalled();
    });

    describe("inside Flatpak", () => {
      beforeEach(() => {
        existing.add("/.flatpak-info");
        jest.spyOn(process, "getuid").mockReturnValue(1000);
      });

      it("accepts a candidate owned by the overflow uid", async () => {
        jest.mocked(readFileSync).mockReturnValue(`${OVERFLOW_UID}\n`);
        openReturns({ [FLATPAK_FILE]: fakeHandle({ uid: OVERFLOW_UID, contents: '{"a":1}' }) });
        const source = new LinuxManagedSettingsSource(logService);

        await expect(source.read()).resolves.toBe('{"a":1}');
      });

      it("rejects a candidate owned by the process's own uid", async () => {
        jest.mocked(readFileSync).mockReturnValue(`${OVERFLOW_UID}\n`);
        openReturns({ [FLATPAK_FILE]: fakeHandle({ uid: 1000 }) });
        const source = new LinuxManagedSettingsSource(logService);

        await expect(source.read()).resolves.toBeUndefined();
        expect(logService.warning).toHaveBeenCalledWith(
          `Managed settings: rejected ${FLATPAK_FILE}, not owned by root.`,
        );
      });

      it("rejects the overflow uid when it is the process's own uid", async () => {
        jest.spyOn(process, "getuid").mockReturnValue(OVERFLOW_UID);
        jest.mocked(readFileSync).mockReturnValue(`${OVERFLOW_UID}\n`);
        openReturns({ [FLATPAK_FILE]: fakeHandle({ uid: OVERFLOW_UID }) });
        const source = new LinuxManagedSettingsSource(logService);

        await expect(source.read()).resolves.toBeUndefined();
      });

      it.each([
        [
          "cannot be read",
          () =>
            jest.mocked(readFileSync).mockImplementation(() => {
              throw errno("EACCES");
            }),
        ],
        ["does not hold an integer", () => jest.mocked(readFileSync).mockReturnValue("nope\n")],
      ])(
        "constructs, logs, and trusts no owner when the overflow uid %s",
        async (_case, arrange) => {
          arrange();
          openReturns({ [ETC_FILE]: fakeHandle({ uid: 0 }) });

          const source = new LinuxManagedSettingsSource(logService);

          expect(logService.warning).toHaveBeenCalledWith(
            "Managed settings: could not read the kernel overflow uid.",
          );
          await expect(source.read()).resolves.toBeUndefined();
        },
      );
    });

    it("rejects a candidate owned by the overflow uid outside Flatpak", async () => {
      openReturns({ [ETC_FILE]: fakeHandle({ uid: OVERFLOW_UID }) });
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.read()).resolves.toBeUndefined();
      expect(readFileSync).not.toHaveBeenCalled();
    });
  });

  describe("watch", () => {
    let watchers: FakeWatcher[];

    beforeEach(() => {
      watchers = [];
      jest.mocked(watch).mockImplementation(((p: string, listener: FakeWatcher["listener"]) => {
        if (!existing.has(p)) {
          throw errno("ENOENT");
        }
        const watcher: FakeWatcher = {
          path: p,
          listener,
          close: jest.fn(),
          on: jest.fn(),
        };
        watchers.push(watcher);
        return watcher;
      }) as any);
    });

    function openWatchers(): string[] {
      return watchers.filter((w) => w.close.mock.calls.length === 0).map((w) => w.path);
    }

    function watcherFor(p: string): FakeWatcher {
      const watcher = watchers.find((w) => w.path === p && w.close.mock.calls.length === 0);
      if (watcher == null) {
        throw new Error(`no open watcher on ${p}`);
      }
      return watcher;
    }

    it("watches the bitwarden directory and signals changes to the managed-settings file", async () => {
      existing.add("/etc").add("/etc/bitwarden");
      const onChanged = jest.fn();
      const source = new LinuxManagedSettingsSource(logService);

      await source.watch(onChanged);
      const watcher = watcherFor("/etc/bitwarden");
      watcher.listener("rename", "managed-settings.json");
      watcher.listener("change", "other.json");
      watcher.listener("change", null);

      expect(openWatchers()).toEqual(["/etc/bitwarden"]);
      expect(onChanged).toHaveBeenCalledTimes(2);
    });

    it("watches the parent of a missing bitwarden directory and moves once it is created", async () => {
      existing.add("/etc");
      const onChanged = jest.fn();
      const source = new LinuxManagedSettingsSource(logService);

      await source.watch(onChanged);
      expect(openWatchers()).toEqual(["/etc"]);

      watcherFor("/etc").listener("rename", "unrelated");
      expect(onChanged).not.toHaveBeenCalled();

      existing.add("/etc/bitwarden");
      watcherFor("/etc").listener("rename", "bitwarden");

      expect(openWatchers()).toEqual(["/etc/bitwarden"]);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("moves the watch back to the parent when the bitwarden directory is removed", async () => {
      existing.add("/etc").add("/etc/bitwarden");
      const onChanged = jest.fn();
      const source = new LinuxManagedSettingsSource(logService);
      await source.watch(onChanged);

      existing.delete("/etc/bitwarden");
      watcherFor("/etc/bitwarden").listener("rename", "bitwarden");

      expect(openWatchers()).toEqual(["/etc"]);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("re-resolves when the bitwarden directory appears between the existence check and the watch", async () => {
      existing.add("/etc");
      jest.mocked(watch).mockImplementationOnce(((p: string, listener: FakeWatcher["listener"]) => {
        existing.add("/etc/bitwarden");
        const watcher: FakeWatcher = { path: p, listener, close: jest.fn(), on: jest.fn() };
        watchers.push(watcher);
        return watcher;
      }) as any);
      const onChanged = jest.fn();
      const source = new LinuxManagedSettingsSource(logService);

      await source.watch(onChanged);

      expect(openWatchers()).toEqual(["/etc/bitwarden"]);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("re-resolves when the bitwarden directory disappears between the existence check and the watch", async () => {
      existing.add("/etc").add("/etc/bitwarden");
      const onChanged = jest.fn();
      const source = new LinuxManagedSettingsSource(logService);
      jest.mocked(existsSync).mockImplementationOnce(() => {
        // The directory exists at the check, then is removed before the watch starts.
        existing.delete("/etc/bitwarden");
        return true;
      });

      await source.watch(onChanged);

      expect(openWatchers()).toEqual(["/etc"]);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("logs and keeps running when neither the directory nor its parent exists", async () => {
      const source = new LinuxManagedSettingsSource(logService);

      await expect(source.watch(jest.fn())).resolves.toBeUndefined();

      expect(openWatchers()).toEqual([]);
      expect(logService.info).toHaveBeenCalledWith(
        "Managed settings: not watching /etc.",
        expect.anything(),
      );
      expect(logService.info).toHaveBeenCalledWith(
        "Managed settings: not watching /run/host/etc.",
        expect.anything(),
      );
    });

    it("logs and closes a watcher that emits an error", async () => {
      existing.add("/etc").add("/etc/bitwarden");
      const source = new LinuxManagedSettingsSource(logService);
      await source.watch(jest.fn());
      const watcher = watcherFor("/etc/bitwarden");
      const [event, onError] = watcher.on.mock.calls[0];

      onError(new Error("EPERM"));

      expect(event).toBe("error");
      expect(watcher.close).toHaveBeenCalled();
      expect(logService.warning).toHaveBeenCalledWith(
        "Managed settings: stopped watching /etc/bitwarden, EPERM",
      );
    });
  });
});
