import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { CliUtils } from "@bitwarden/cli/utils";

/** The longest rule JSON accepted from a file or stdin. A rule is a few hundred bytes. */
export const MAX_RULE_JSON_LENGTH = 1024 * 1024;

export type RuleInputOptions = { file?: string };

/** The seams {@link readRuleJson} reads through, replaced in specs. */
export interface RuleInputReaders {
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

const DEFAULT_READERS: RuleInputReaders = {
  readFile: (path) => CliUtils.readFile(path),
  readStdin: () => CliUtils.readStdin(),
};

/**
 * The text of a rule request from exactly one of the argument, `--file` or standard input, which
 * is the fallback when neither is given, as in `bw create item`. Standard input is not read
 * under `bw serve`, which has no terminal.
 *
 * @throws PamInputError when both an argument and a file are given, a file cannot be read, or the
 *   text is too long. A refusal never contains the text or the reader's message.
 */
export async function readRuleJson(
  argument: string | undefined,
  options: RuleInputOptions,
  readers: RuleInputReaders = DEFAULT_READERS,
): Promise<string> {
  if (argument != null && options.file != null) {
    throw new PamInputError("Give the rule as an argument or with --file, not both.");
  }
  let text: string;
  if (argument != null) {
    text = argument;
  } else if (options.file != null) {
    try {
      text = await readers.readFile(options.file);
    } catch {
      // The reader's message can name the path, so it is not repeated.
      throw new PamInputError("The rule file could not be read.");
    }
  } else if (process.env.BW_SERVE !== "true") {
    text = await readers.readStdin();
  } else {
    text = "";
  }
  if (text.length > MAX_RULE_JSON_LENGTH) {
    throw new PamInputError(`The rule is longer than ${MAX_RULE_JSON_LENGTH} characters.`);
  }
  return text;
}
