import * as fs from "fs";

import { readSecureManagedConfigDir } from "./secure-config-dir";

jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

function statLike(over: Partial<fs.Stats> & { uid?: number; mode?: number }): fs.Stats {
  return {
    isSymbolicLink: () => false,
    isFile: () => true,
    uid: 0,
    gid: 0,
    mode: 0o644,
    ...over,
  } as unknown as fs.Stats;
}

describe("readSecureManagedConfigDir (posix)", () => {
  const logger = { warning: jest.fn() };
  beforeEach(() => jest.resetAllMocks());

  it("reads a root-owned, non-writable JSON file", () => {
    mockFs.readdirSync.mockReturnValue(["policy.json"] as unknown as fs.Dirent[]);
    mockFs.lstatSync.mockReturnValue(statLike({}));
    mockFs.statSync.mockImplementation(() => statLike({ uid: 0, mode: 0o644 }));
    mockFs.readFileSync.mockReturnValue('{"environment":{"base":"https://x"}}');

    const result = readSecureManagedConfigDir("/etc/bitwarden/policies", "linux", logger);

    expect(result).toEqual({ environment: { base: "https://x" } });
    expect(logger.warning).not.toHaveBeenCalled();
  });

  it("skips and warns on a non-root-owned file", () => {
    mockFs.readdirSync.mockReturnValue(["policy.json"] as unknown as fs.Dirent[]);
    mockFs.lstatSync.mockReturnValue(statLike({}));
    mockFs.statSync.mockImplementation(() => statLike({ uid: 1000, mode: 0o644 }));

    const result = readSecureManagedConfigDir("/etc/bitwarden/policies", "linux", logger);

    expect(result).toEqual({});
    expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining("policy.json"));
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
  });

  it("skips and warns on a group/world-writable file", () => {
    mockFs.readdirSync.mockReturnValue(["policy.json"] as unknown as fs.Dirent[]);
    mockFs.lstatSync.mockReturnValue(statLike({}));
    mockFs.statSync.mockImplementation(() => statLike({ uid: 0, mode: 0o646 }));

    expect(readSecureManagedConfigDir("/etc/bitwarden/policies", "linux", logger)).toEqual({});
    expect(logger.warning).toHaveBeenCalled();
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
  });

  it("skips and warns on a symlinked file", () => {
    mockFs.readdirSync.mockReturnValue(["policy.json"] as unknown as fs.Dirent[]);
    mockFs.lstatSync.mockReturnValue(statLike({ isSymbolicLink: () => true }));

    expect(readSecureManagedConfigDir("/etc/bitwarden/policies", "linux", logger)).toEqual({});
    expect(logger.warning).toHaveBeenCalled();
  });

  it("returns empty and does not warn when the directory is absent", () => {
    mockFs.readdirSync.mockImplementation(() => {
      const e: NodeJS.ErrnoException = new Error("ENOENT");
      e.code = "ENOENT";
      throw e;
    });

    expect(readSecureManagedConfigDir("/etc/bitwarden/policies", "linux", logger)).toEqual({});
    expect(logger.warning).not.toHaveBeenCalled();
  });
});

describe("readSecureManagedConfigDir (win32)", () => {
  const logger = { warning: jest.fn() };
  beforeEach(() => jest.resetAllMocks());

  it("reads a regular file under the canonical ProgramData dir without a posix check", () => {
    const dir = "C:\\ProgramData\\Bitwarden\\policies";
    mockFs.readdirSync.mockReturnValue(["policy.json"] as unknown as fs.Dirent[]);
    mockFs.lstatSync.mockReturnValue(statLike({ isFile: () => true }));
    mockFs.readFileSync.mockReturnValue('{"environment":{"base":"https://x"}}');

    const result = readSecureManagedConfigDir(dir, "win32", logger);

    expect(result).toEqual({ environment: { base: "https://x" } });
  });
});
