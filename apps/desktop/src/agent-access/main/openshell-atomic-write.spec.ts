import { AtomicWriteOps, AtomicWriteStat, writeFileAtomicNoFollow } from "./openshell-atomic-write";

function stat(kind: "file" | "symlink" | "dir", mode = 0o100640): AtomicWriteStat {
  return { mode, isSymbolicLink: () => kind === "symlink", isFile: () => kind === "file" };
}

function fakeOps(existing: AtomicWriteStat | null) {
  const log: string[] = [];
  const ops: AtomicWriteOps = {
    lstat: jest.fn(async (p: string) => {
      log.push(`lstat ${p}`);
      if (existing == null) {
        throw Object.assign(new Error("nope"), { code: "ENOENT" });
      }
      return existing;
    }),
    writeExclusive: jest.fn(async (p: string, _c: string, mode: number) => {
      log.push(`write ${p} ${mode.toString(8)}`);
    }),
    chmod: jest.fn(async (p: string, mode: number) => {
      log.push(`chmod ${p} ${mode.toString(8)}`);
    }),
    rename: jest.fn(async (a: string, b: string) => {
      log.push(`rename ${a} ${b}`);
    }),
    rm: jest.fn(async (p: string) => {
      log.push(`rm ${p}`);
    }),
  };
  return { ops, log };
}

describe("writeFileAtomicNoFollow", () => {
  it("refuses a symlink target and writes nothing", async () => {
    const { ops } = fakeOps(stat("symlink"));
    await expect(writeFileAtomicNoFollow(ops, "/d/f", "x", 0o600, false)).rejects.toThrow(
      /symlink/,
    );
    expect(ops.writeExclusive).not.toHaveBeenCalled();
    expect(ops.rename).not.toHaveBeenCalled();
  });

  it("refuses a directory target", async () => {
    const { ops } = fakeOps(stat("dir"));
    await expect(writeFileAtomicNoFollow(ops, "/d/f", "x", 0o600, false)).rejects.toThrow();
    expect(ops.writeExclusive).not.toHaveBeenCalled();
  });

  it("uses a random temp suffix, writes exclusively, chmods, then renames", async () => {
    const first = fakeOps(null);
    const second = fakeOps(null);
    await writeFileAtomicNoFollow(first.ops, "/d/f", "x", 0o600, false);
    await writeFileAtomicNoFollow(second.ops, "/d/f", "x", 0o600, false);
    const temp = (first.ops.writeExclusive as jest.Mock).mock.calls[0][0] as string;
    const otherTemp = (second.ops.writeExclusive as jest.Mock).mock.calls[0][0] as string;
    expect(temp).toMatch(/^\/d\/f\.bitwarden-tmp-[0-9a-f]{16}$/);
    expect(temp).not.toBe(otherTemp);
    expect(first.log).toEqual([
      "lstat /d/f",
      `write ${temp} 600`,
      `chmod ${temp} 600`,
      `rename ${temp} /d/f`,
    ]);
  });

  it("keeps the existing mode when asked, and the default for a new file", async () => {
    const existing = fakeOps(stat("file", 0o100600));
    await writeFileAtomicNoFollow(existing.ops, "/d/f", "x", 0o644, true);
    expect((existing.ops.chmod as jest.Mock).mock.calls[0][1]).toBe(0o600);

    const created = fakeOps(null);
    await writeFileAtomicNoFollow(created.ops, "/d/f", "x", 0o644, true);
    expect((created.ops.chmod as jest.Mock).mock.calls[0][1]).toBe(0o644);
  });

  it("removes the temp file when the rename fails", async () => {
    const { ops } = fakeOps(null);
    (ops.rename as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    await expect(writeFileAtomicNoFollow(ops, "/d/f", "x", 0o600, false)).rejects.toThrow("boom");
    expect(ops.rm).toHaveBeenCalledTimes(1);
  });
});
