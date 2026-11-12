import { PamInputError } from "@bitwarden/bit-common/pam/shared";

import { parseTemplateMethod, readTargetSystemInput } from "./target-system-input";

describe("readTargetSystemInput", () => {
  const readers = {
    readFile: jest.fn(),
    readStdin: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("reads the argument", async () => {
    await expect(readTargetSystemInput({ json: '{"a":1}' }, readers)).resolves.toEqual({ a: 1 });
  });

  it("reads a file", async () => {
    readers.readFile.mockResolvedValue('{"b":2}');
    await expect(readTargetSystemInput({ file: "t.json" }, readers)).resolves.toEqual({ b: 2 });
  });

  it("reads stdin", async () => {
    readers.readStdin.mockResolvedValue('{"c":3}');
    await expect(readTargetSystemInput({ stdin: true }, readers)).resolves.toEqual({ c: 3 });
  });

  it("needs exactly one source", async () => {
    await expect(readTargetSystemInput({}, readers)).rejects.toBeInstanceOf(PamInputError);
    await expect(
      readTargetSystemInput({ json: "{}", stdin: true }, readers),
    ).rejects.toBeInstanceOf(PamInputError);
  });

  it("does not repeat a file reader's message", async () => {
    readers.readFile.mockRejectedValue(new Error("ENOENT /home/someone/secret.json"));

    await expect(readTargetSystemInput({ file: "x" }, readers)).rejects.toThrow(
      "The request file could not be read.",
    );
  });

  it("refuses an empty stdin", async () => {
    readers.readStdin.mockResolvedValue("");
    await expect(readTargetSystemInput({ stdin: true }, readers)).rejects.toThrow(/empty/);
  });
});

describe("parseTemplateMethod", () => {
  it("defaults to automatic and accepts either method", () => {
    expect(parseTemplateMethod(undefined)).toBe("automatic");
    expect(parseTemplateMethod("MANUAL")).toBe("manual");
  });

  it("refuses another value", () => {
    expect(() => parseTemplateMethod("hybrid")).toThrow(PamInputError);
  });
});
