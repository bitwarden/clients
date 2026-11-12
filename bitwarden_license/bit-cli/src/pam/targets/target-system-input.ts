import { PamInputError, sanitizeUntrusted } from "@bitwarden/bit-common/pam/shared";
import { parseTargetSystemJson } from "@bitwarden/bit-common/pam/targets";
import { CliUtils } from "@bitwarden/cli/utils";

export type TargetSystemInputOptions = {
  /** The positional JSON. */
  json?: string;
  /** `--file <path>`. */
  file?: string;
  /** `--stdin`. */
  stdin?: boolean;
};

/** The seams {@link readTargetSystemInput} reads through, replaced in specs. */
export interface TargetSystemInputReaders {
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

const DEFAULT_READERS: TargetSystemInputReaders = {
  readFile: (path) => CliUtils.readFile(path),
  readStdin: () => CliUtils.readStdin(),
};

/**
 * Reads the request JSON from exactly one of the argument, `--file` or `--stdin`. A file or stdin
 * keeps the password policy out of shell history. The text is never echoed back or logged.
 * @throws PamInputError
 */
export async function readTargetSystemInput(
  options: TargetSystemInputOptions,
  readers: TargetSystemInputReaders = DEFAULT_READERS,
): Promise<Record<string, unknown>> {
  const given = [options.json != null, options.file != null, options.stdin === true].filter(
    Boolean,
  ).length;
  if (given !== 1) {
    throw new PamInputError(
      "Give the request as exactly one of a JSON argument, --file <path> or --stdin. Run `bw pam target template` for the shape.",
    );
  }
  let text: string;
  if (options.json != null) {
    text = options.json;
  } else if (options.file != null) {
    try {
      text = await readers.readFile(options.file);
    } catch {
      // The reader's message can name the path or the content, so it is not repeated.
      throw new PamInputError("The request file could not be read.");
    }
  } else {
    text = await readers.readStdin();
  }
  return parseTargetSystemJson(text);
}

/** Validates `--method` for `template`. */
export function parseTemplateMethod(value: string | undefined): "automatic" | "manual" {
  const method = (value ?? "automatic").toLowerCase();
  if (method !== "automatic" && method !== "manual") {
    throw new PamInputError(
      `\`${sanitizeUntrusted(value, 40)}\` is not a method. Use automatic or manual.`,
    );
  }
  return method;
}
