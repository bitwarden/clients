import { PamInputError } from "@bitwarden/bit-common/pam/shared";

import { MAX_PAM_TEXT_LENGTH, PamTextReaders, readReasonText } from "./read-reason-text";

describe("readReasonText", () => {
  const readers: jest.Mocked<PamTextReaders> = {
    readFile: jest.fn(),
    readStdin: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("reads the option", async () => {
    await expect(readReasonText({ reason: "  maintenance  " }, { readers })).resolves.toBe(
      "maintenance",
    );
    expect(readers.readFile).not.toHaveBeenCalled();
    expect(readers.readStdin).not.toHaveBeenCalled();
  });

  it("reads a file", async () => {
    readers.readFile.mockResolvedValue("from file\n");

    await expect(readReasonText({ reasonfile: "r.txt" }, { readers })).resolves.toBe("from file");
    expect(readers.readFile).toHaveBeenCalledWith("r.txt");
  });

  it("reads stdin", async () => {
    readers.readStdin.mockResolvedValue("from stdin\n");

    await expect(readReasonText({ reasonstdin: true }, { readers })).resolves.toBe("from stdin");
  });

  it.each([
    [{ reason: "a", reasonfile: "f" }],
    [{ reason: "a", reasonstdin: true }],
    [{ reasonfile: "f", reasonstdin: true }],
  ])("refuses more than one source %p", async (options) => {
    await expect(readReasonText(options, { readers })).rejects.toThrow(
      "only one of --reason, --reasonfile or --reasonstdin",
    );
  });

  it("refuses a missing text when required, naming the label", async () => {
    await expect(readReasonText({}, { readers, label: "comment", required: true })).rejects.toThrow(
      "A comment is required.",
    );
  });

  it("returns undefined for a missing optional text", async () => {
    await expect(readReasonText({}, { readers })).resolves.toBeUndefined();
  });

  it.each([{ reason: "   " }, { reasonstdin: true }])(
    "refuses an empty text from a given source %p even when optional",
    async (options) => {
      readers.readStdin.mockResolvedValue("");

      await expect(readReasonText(options, { readers })).rejects.toThrow("The reason is empty.");
    },
  );

  it("refuses text over the limit without echoing it", async () => {
    const text = "x".repeat(MAX_PAM_TEXT_LENGTH + 1);

    const failure = await readReasonText({ reason: text }, { readers }).catch((e) => e);

    expect(failure).toBeInstanceOf(PamInputError);
    expect(failure.message).not.toContain("xxxx");
  });

  it("does not repeat the reader's error, which can name the path or the content", async () => {
    readers.readFile.mockRejectedValue("ENOENT: /home/me/secret-reason.txt");

    const failure = await readReasonText({ reasonfile: "x" }, { readers }).catch((e) => e);

    expect(failure.message).toBe("The reason file could not be read.");
  });
});
