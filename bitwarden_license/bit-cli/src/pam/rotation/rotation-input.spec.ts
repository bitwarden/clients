import { PamInputError } from "@bitwarden/bit-common/pam/shared";

import { INLINE_IDENTITY_WARNING, readRotationJson, warnInlineIdentity } from "./rotation-input";

describe("readRotationJson", () => {
  const readers = {
    readFile: jest.fn(),
    readStdin: jest.fn(),
  };

  beforeEach(() => jest.resetAllMocks());

  it("reads the argument, a file or stdin", async () => {
    readers.readFile.mockResolvedValue('{"a":1}');
    readers.readStdin.mockResolvedValue('{"b":2}');
    expect(await readRotationJson("{}", {}, readers)).toBe("{}");
    expect(await readRotationJson(undefined, { file: "r.json" }, readers)).toBe('{"a":1}');
    expect(await readRotationJson(undefined, { stdin: true }, readers)).toBe('{"b":2}');
  });

  it("requires exactly one source", async () => {
    await expect(readRotationJson(undefined, {}, readers)).rejects.toThrow(PamInputError);
    await expect(readRotationJson("{}", { stdin: true }, readers)).rejects.toThrow(PamInputError);
  });

  it("does not repeat the path or the reader's message", async () => {
    readers.readFile.mockRejectedValue("ENOENT secret/path.json");
    const error = await readRotationJson(undefined, { file: "secret/path.json" }, readers).catch(
      (e: Error) => e,
    );
    expect((error as Error).message).not.toContain("secret");
  });

  it("refuses an empty request", async () => {
    readers.readStdin.mockResolvedValue("  ");
    await expect(readRotationJson(undefined, { stdin: true }, readers)).rejects.toThrow("empty");
  });
});

describe("warnInlineIdentity", () => {
  let stderr: jest.SpyInstance;
  const quiet = process.env.BW_QUIET;

  beforeEach(() => {
    delete process.env.BW_QUIET;
    stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    stderr.mockRestore();
    process.env.BW_QUIET = quiet;
    if (quiet == null) {
      delete process.env.BW_QUIET;
    }
  });

  const written = () => stderr.mock.calls.map((c) => String(c[0])).join("");

  it("warns, without repeating the request, when inline JSON names the identity", () => {
    warnInlineIdentity('{"accountIdentity":"svc-account"}');
    expect(written()).toContain(INLINE_IDENTITY_WARNING);
    expect(written()).not.toContain("svc-account");
  });

  it("stays silent for a file or stdin, an inline request without it, or a quiet run", () => {
    warnInlineIdentity(undefined);
    warnInlineIdentity('{"cipherId":"c"}');
    process.env.BW_QUIET = "true";
    warnInlineIdentity('{"accountIdentity":"x"}');
    expect(written()).toBe("");
  });
});
