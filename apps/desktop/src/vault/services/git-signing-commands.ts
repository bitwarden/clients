/**
 * A single `git config` invocation, paired with a human-readable display form.
 *
 * `args` is the argv passed to the native runner (no shell involvement).
 * `display` is the line shown in the UI and copied to the clipboard — it is
 * shell-quoted so a user can paste it into a POSIX shell.
 */
export interface GitSigningCommand {
  args: string[];
  display: string;
}

/**
 * Build the `git config` commands that configure SSH signing using the
 * provided OpenSSH-format public key. The key is embedded inline in git
 * config via the `key::<openssh key>` syntax — nothing is written to disk.
 */
export function buildGitSigningCommands(publicKey: string): GitSigningCommand[] {
  const trimmed = publicKey.trim();
  if (trimmed.length === 0) {
    throw new Error("publicKey must not be empty");
  }
  const signingKeyValue = `key::${trimmed}`;

  return [
    {
      args: ["config", "--global", "gpg.format", "ssh"],
      display: "git config --global gpg.format ssh",
    },
    {
      args: ["config", "--global", "user.signingkey", signingKeyValue],
      display: `git config --global user.signingkey ${shellQuote(signingKeyValue)}`,
    },
  ];
}

/**
 * Optional opt-in command: make git sign every commit by default.
 */
export function buildCommitSignOptInCommand(): GitSigningCommand {
  return {
    args: ["config", "--global", "commit.gpgsign", "true"],
    display: "git config --global commit.gpgsign true",
  };
}

/**
 * POSIX-shell single-quote a string. Wraps the string in `'…'` and escapes
 * any embedded single quotes using the `'\''` idiom. Used only for the
 * display form — the native runner takes argv directly.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
