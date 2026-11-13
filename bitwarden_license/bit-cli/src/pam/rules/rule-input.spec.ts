import { PamInputError } from "@bitwarden/bit-common/pam/shared";

import { MAX_RULE_JSON_LENGTH, readRuleJson, RuleInputReaders } from "./rule-input";

describe("readRuleJson", () => {
  let readers: jest.Mocked<RuleInputReaders>;
  let serve: string | undefined;

  beforeEach(() => {
    serve = process.env.BW_SERVE;
    delete process.env.BW_SERVE;
    readers = { readFile: jest.fn(), readStdin: jest.fn() };
  });

  afterEach(() => {
    if (serve == null) {
      delete process.env.BW_SERVE;
    } else {
      process.env.BW_SERVE = serve;
    }
  });

  it("returns the argument without touching a reader", async () => {
    await expect(readRuleJson('{"name":"r"}', {}, readers)).resolves.toBe('{"name":"r"}');

    expect(readers.readFile).not.toHaveBeenCalled();
    expect(readers.readStdin).not.toHaveBeenCalled();
  });

  it("refuses an argument together with a file and reads nothing", async () => {
    await expect(readRuleJson("{}", { file: "rule.json" }, readers)).rejects.toThrow(PamInputError);

    expect(readers.readFile).not.toHaveBeenCalled();
  });

  it("reads the file when only a file is given", async () => {
    readers.readFile.mockResolvedValue("from file");

    await expect(readRuleJson(undefined, { file: "rule.json" }, readers)).resolves.toBe(
      "from file",
    );

    expect(readers.readFile).toHaveBeenCalledWith("rule.json");
    expect(readers.readStdin).not.toHaveBeenCalled();
  });

  it("does not repeat the reader's message, which can name the path", async () => {
    readers.readFile.mockRejectedValue(new Error("ENOENT: /home/someone/secret-rule.json"));

    const error = await readRuleJson(undefined, { file: "x" }, readers).catch((e) => e);

    expect(error).toBeInstanceOf(PamInputError);
    expect(error.message).toBe("The rule file could not be read.");
    expect(error.message).not.toContain("secret-rule");
  });

  it("falls back to standard input when neither is given", async () => {
    readers.readStdin.mockResolvedValue("from stdin");

    await expect(readRuleJson(undefined, {}, readers)).resolves.toBe("from stdin");
  });

  it("does not read standard input under bw serve", async () => {
    process.env.BW_SERVE = "true";

    await expect(readRuleJson(undefined, {}, readers)).resolves.toBe("");

    expect(readers.readStdin).not.toHaveBeenCalled();
  });

  it("accepts text of exactly the maximum length and refuses one character more", async () => {
    const atLimit = "a".repeat(MAX_RULE_JSON_LENGTH);

    await expect(readRuleJson(atLimit, {}, readers)).resolves.toBe(atLimit);
    await expect(readRuleJson(atLimit + "a", {}, readers)).rejects.toThrow(
      `longer than ${MAX_RULE_JSON_LENGTH}`,
    );
  });

  it("applies the limit to a file and to standard input", async () => {
    const tooLong = "a".repeat(MAX_RULE_JSON_LENGTH + 1);
    readers.readFile.mockResolvedValue(tooLong);
    readers.readStdin.mockResolvedValue(tooLong);

    await expect(readRuleJson(undefined, { file: "f" }, readers)).rejects.toThrow(PamInputError);
    await expect(readRuleJson(undefined, {}, readers)).rejects.toThrow(PamInputError);
  });

  it("does not put the rule text in the refusal for a long rule", async () => {
    const error = await readRuleJson("secret".repeat(MAX_RULE_JSON_LENGTH), {}, readers).catch(
      (e) => e,
    );

    expect(error.message).not.toContain("secret");
  });
});
