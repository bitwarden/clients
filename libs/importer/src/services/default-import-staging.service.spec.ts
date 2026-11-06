import { firstValueFrom } from "rxjs";

import { ImportResult } from "../models/import-result";

import { DefaultImportStagingService } from "./default-import-staging.service";
import { StagedImport } from "./import-staging.service.abstraction";

describe("DefaultImportStagingService", () => {
  let sut: DefaultImportStagingService;

  const parsed = (): StagedImport => ({
    kind: "parsed",
    importType: "bitwarden",
    result: new ImportResult(),
  });

  beforeEach(() => {
    sut = new DefaultImportStagingService();
  });

  it("starts empty", async () => {
    expect(sut.current()).toBeUndefined();
    expect(await firstValueFrom(sut.staged$)).toBeUndefined();
  });

  it("returns what was staged", async () => {
    const staged = parsed();

    sut.stage(staged);

    expect(sut.current()).toBe(staged);
    expect(await firstValueFrom(sut.staged$)).toBe(staged);
  });

  it("replaces an earlier staged import", () => {
    const first = parsed();
    const second = parsed();

    sut.stage(first);
    sut.stage(second);

    expect(sut.current()).toBe(second);
  });

  it("zeroes the file and key file of a replaced sdk import", () => {
    const file = Uint8Array.from([1, 2, 3]);
    const keyFile = Uint8Array.from([4, 5, 6]);
    sut.stage({
      kind: "sdk",
      format: "keepasskdbx",
      file,
      credentials: { kind: "passwordWithKeyFile", password: "pw", keyFile },
    });

    sut.stage(parsed());

    expect(Array.from(file)).toEqual([0, 0, 0]);
    expect(Array.from(keyFile)).toEqual([0, 0, 0]);
  });

  it("clear drops the staged import and zeroes sdk bytes", () => {
    const file = Uint8Array.from([9, 9]);
    sut.stage({
      kind: "sdk",
      format: "keepasskdbx",
      file,
      credentials: { kind: "password", password: "pw" },
    });

    sut.clear();

    expect(sut.current()).toBeUndefined();
    expect(Array.from(file)).toEqual([0, 0]);
  });

  it("clear tolerates an sdk import with no key file", () => {
    sut.stage({
      kind: "sdk",
      format: "keepasskdbx",
      file: Uint8Array.from([1]),
      credentials: { kind: "passwordWithKeyFile", password: "pw", keyFile: null },
    });

    expect(() => sut.clear()).not.toThrow();
    expect(sut.current()).toBeUndefined();
  });
});
