/// Helpers shared by the build script specs. Not a spec itself: jest collects only `*.spec.ts`.

/// A command line as it would be typed, so a case reads as the command it is about rather than
/// as an array of fragments. Double quotes group a value containing spaces, the way a shell
/// would -- signing identities are the only values here that need it.
///
/// Note that repeatable options accumulate, so a case varying `--architecture` or
/// `--distribution-channel` has to write the whole line rather than appending to a baseline.
export function args(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]);
}
