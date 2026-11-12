import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { CliUtils } from "@bitwarden/cli/utils";

export type RotationInputOptions = { file?: string; stdin?: boolean };

/** The seams {@link readRotationJson} reads through, replaced in specs. */
export interface RotationInputReaders {
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

const DEFAULT_READERS: RotationInputReaders = {
  readFile: (path) => CliUtils.readFile(path),
  readStdin: () => CliUtils.readStdin(),
};

/**
 * The request JSON of `create` and `update`, from exactly one of the argument, `--file` or
 * `--stdin`. The request holds the account identity, so a file or stdin keeps it out of shell
 * history. A read failure never repeats the path or the text.
 * @throws PamInputError when none or several are given, or the file cannot be read.
 */
export async function readRotationJson(
  inline: string | undefined,
  options: RotationInputOptions,
  readers: RotationInputReaders = DEFAULT_READERS,
): Promise<string> {
  const given = [inline != null, options.file != null, options.stdin === true].filter(
    Boolean,
  ).length;
  if (given !== 1) {
    throw new PamInputError("Give the request as exactly one of <json>, --file <path> or --stdin.");
  }
  let text: string;
  if (inline != null) {
    text = inline;
  } else if (options.file != null) {
    try {
      text = await readers.readFile(options.file);
    } catch {
      throw new PamInputError("The request file could not be read.");
    }
  } else {
    text = await readers.readStdin();
  }
  if (text.trim().length === 0) {
    throw new PamInputError("The request is empty.");
  }
  return text;
}
