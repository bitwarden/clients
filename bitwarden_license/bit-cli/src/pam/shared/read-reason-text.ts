import { Command } from "commander";

import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { CliUtils } from "@bitwarden/cli/utils";

/** The longest reason or comment accepted from a file or stdin. */
export const MAX_PAM_TEXT_LENGTH = 64 * 1024;

export type PamTextOptions = {
  /** The text itself, from `--reason <text>`. */
  reason?: string;
  /** A path, from `--reasonfile <path>`. */
  reasonfile?: string;
  /** From `--reasonstdin`. */
  reasonstdin?: boolean;
};

/** The seams {@link readReasonText} reads through, replaced in specs. */
export interface PamTextReaders {
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

const DEFAULT_READERS: PamTextReaders = {
  readFile: (path) => CliUtils.readFile(path),
  readStdin: () => CliUtils.readStdin(),
};

/**
 * Reads a reason or comment from exactly one of an option, a file or stdin. Reasons and comments
 * are never asked for with an interactive prompt, so they work under `--nointeraction`, and they
 * are never echoed back or logged.
 *
 * @param label Names the text in refusals: `reason` by default, `comment` for decisions.
 * @param required Whether an absent text is a refusal. Returns `undefined` when it is not.
 * @throws PamInputError when more than one source is given, a required text is missing or empty,
 *   or the text is longer than {@link MAX_PAM_TEXT_LENGTH}. The refusal never contains the text.
 */
export async function readReasonText(
  options: PamTextOptions,
  settings: { label?: string; required?: boolean; readers?: PamTextReaders } = {},
): Promise<string | undefined> {
  const label = settings.label ?? "reason";
  const readers = settings.readers ?? DEFAULT_READERS;
  const given = [
    options.reason != null,
    options.reasonfile != null,
    options.reasonstdin === true,
  ].filter(Boolean).length;

  if (given > 1) {
    throw new PamInputError(
      `Give the ${label} with only one of --reason, --reasonfile or --reasonstdin.`,
    );
  }

  let text: string | undefined;
  if (options.reason != null) {
    text = options.reason;
  } else if (options.reasonfile != null) {
    try {
      text = await readers.readFile(options.reasonfile);
    } catch {
      // The reader's message can name the path or the file's content, so it is not repeated.
      throw new PamInputError(`The ${label} file could not be read.`);
    }
  } else if (options.reasonstdin === true) {
    text = await readers.readStdin();
  }

  const trimmed = text?.trim();
  if (trimmed == null || trimmed.length === 0) {
    if (settings.required === true || given > 0) {
      throw new PamInputError(
        given > 0
          ? `The ${label} is empty.`
          : `A ${label} is required. Give it with --reason, --reasonfile or --reasonstdin.`,
      );
    }
    return undefined;
  }
  if (trimmed.length > MAX_PAM_TEXT_LENGTH) {
    throw new PamInputError(`The ${label} is longer than ${MAX_PAM_TEXT_LENGTH} characters.`);
  }
  return trimmed;
}

/** Adds `--reason`, `--reasonfile` and `--reasonstdin`. */
export function addReasonOptions(command: Command): Command {
  return command
    .option("--reason <reason>", "The reason, as text.")
    .option("--reasonfile <path>", "Read the reason from a file.")
    .option("--reasonstdin", "Read the reason from standard input.");
}
