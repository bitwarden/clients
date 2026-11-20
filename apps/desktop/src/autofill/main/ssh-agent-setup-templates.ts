/**
 * Fixed templates and pure parsers for the SSH agent setup flow. Nothing in this file touches the
 * file system. Every byte the setup service writes is produced here from a validated socket path;
 * key names, comments and emails never reach these templates.
 */

export const MANAGED_BLOCK_BEGIN = "# >>> Bitwarden SSH agent (managed) >>>";
export const MANAGED_BLOCK_END = "# <<< Bitwarden SSH agent (managed) <<<";
const APP_OWNED_HEADER =
  "# Managed by Bitwarden. Removed when you undo SSH agent setup in Bitwarden.";

/** Only these characters may appear in a socket path we write. Anything else is `blocked`. */
const SAFE_PATH_CHARS = /^[A-Za-z0-9/._-]+$/;
const MAX_SAFE_PATH_LENGTH = 1024;
export const MAX_DISPLAY_LINE_LENGTH = 120;

/** The `Include` target written to ~/.ssh/config outside of dev/test home overrides. */
export const SSH_CONFIG_INCLUDE_TARGET = "~/.ssh/bitwarden/agent.conf";

/** Returns true when the path is absolute and only contains characters that are safe to emit. */
export function isSafeSocketPath(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    value.length > 1 &&
    value.length <= MAX_SAFE_PATH_LENGTH &&
    value.startsWith("/") &&
    SAFE_PATH_CHARS.test(value)
  );
}

export function sshConfigBlockLines(includeTarget: string): string[] {
  return [MANAGED_BLOCK_BEGIN, `Include ${includeTarget}`, MANAGED_BLOCK_END];
}

export function agentConfContent(socketPath: string): string {
  return [APP_OWNED_HEADER, "Host *", `  IdentityAgent "${socketPath}"`, ""].join("\n");
}

function posixExportLine(socketPath: string): string {
  return `if [ -z "\${SSH_CONNECTION:-}" ]; then export SSH_AUTH_SOCK='${socketPath}'; fi`;
}

export function posixShellBlockLines(socketPath: string): string[] {
  return [MANAGED_BLOCK_BEGIN, posixExportLine(socketPath), MANAGED_BLOCK_END];
}

export function fishDropInContent(socketPath: string): string {
  return [
    APP_OWNED_HEADER,
    MANAGED_BLOCK_BEGIN,
    "if not set -q SSH_CONNECTION",
    `    set -gx SSH_AUTH_SOCK '${socketPath}'`,
    "end",
    MANAGED_BLOCK_END,
    "",
  ].join("\n");
}

/** Copy-ready commands for the guided flow. The socket path must already be validated. */
export function guidedPosixExportCommand(socketPath: string): string {
  return `export SSH_AUTH_SOCK='${socketPath}'`;
}

export function guidedFishExportCommand(socketPath: string): string {
  return `set -gx SSH_AUTH_SOCK '${socketPath}'`;
}

/** Shown to Windows users only. The app never executes it. */
export const WINDOWS_DISABLE_OPENSSH_AGENT_COMMAND =
  "Get-Service ssh-agent | Stop-Service -PassThru | Set-Service -StartupType Disabled";

/** Parses the socket path out of an app-owned agent.conf, or null when it is not our template. */
export function parseAgentConfSocket(content: string): string | null {
  const match = /^ {2}IdentityAgent "([^"\n]*)"$/m.exec(content);
  if (match == null || !isSafeSocketPath(match[1])) {
    return null;
  }
  return content === agentConfContent(match[1]) ? match[1] : null;
}

/** Parses the socket path out of an app-owned fish drop-in, or null when it is not our template. */
export function parseFishDropInSocket(content: string): string | null {
  const match = /^ {4}set -gx SSH_AUTH_SOCK '([^'\n]*)'$/m.exec(content);
  if (match == null || !isSafeSocketPath(match[1])) {
    return null;
  }
  return content === fishDropInContent(match[1]) ? match[1] : null;
}

/** Splits text into lines. The trailing empty element (after a final newline) is kept. */
export function splitLines(content: string): string[] {
  return content.split("\n");
}

function normalizeLine(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

export interface ManagedBlockRange {
  /** Index of the begin marker line. */
  start: number;
  /** Index of the end marker line (inclusive). */
  end: number;
}

export interface ManagedBlockScan {
  blocks: ManagedBlockRange[];
  /** True when markers are unbalanced, nested or out of order. */
  malformed: boolean;
}

export function findManagedBlocks(lines: string[]): ManagedBlockScan {
  const blocks: ManagedBlockRange[] = [];
  let open: number | null = null;
  let malformed = false;
  lines.forEach((raw, index) => {
    const line = normalizeLine(raw);
    if (line === MANAGED_BLOCK_BEGIN) {
      if (open != null) {
        malformed = true;
      }
      open = index;
    } else if (line === MANAGED_BLOCK_END) {
      if (open == null) {
        malformed = true;
      } else {
        blocks.push({ start: open, end: index });
        open = null;
      }
    }
  });
  if (open != null) {
    malformed = true;
  }
  return { blocks, malformed };
}

function blockBody(lines: string[], block: ManagedBlockRange): string[] {
  return lines.slice(block.start, block.end + 1).map(normalizeLine);
}

export function isIntactSshConfigBlock(
  lines: string[],
  block: ManagedBlockRange,
  includeTarget: string,
): boolean {
  const body = blockBody(lines, block);
  const expected = sshConfigBlockLines(includeTarget);
  return body.length === expected.length && body.every((line, i) => line === expected[i]);
}

/** Returns the socket path of an intact POSIX shell block, or null when it was edited. */
export function parsePosixBlockSocket(lines: string[], block: ManagedBlockRange): string | null {
  const body = blockBody(lines, block);
  if (body.length !== 3) {
    return null;
  }
  const match =
    /^if \[ -z "\$\{SSH_CONNECTION:-\}" \]; then export SSH_AUTH_SOCK='([^']*)'; fi$/.exec(body[1]);
  if (match == null || !isSafeSocketPath(match[1])) {
    return null;
  }
  return match[1];
}

export function removeRanges(lines: string[], ranges: ManagedBlockRange[]): string[] {
  return lines.filter((_, index) => !ranges.some((r) => index >= r.start && index <= r.end));
}

function insideRanges(index: number, ranges: ManagedBlockRange[]): boolean {
  return ranges.some((r) => index >= r.start && index <= r.end);
}

export interface FoundLine {
  /** Raw line text. Run through `sanitizeDisplayLine` before it leaves the main process. */
  line: string;
  /** 1-based line number. */
  lineNumber: number;
  /** The value the line assigns, when it could be parsed. */
  value: string | null;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Finds `IdentityAgent` directives outside of our managed blocks. */
export function findIdentityAgentLines(lines: string[], exclude: ManagedBlockRange[]): FoundLine[] {
  const found: FoundLine[] = [];
  lines.forEach((raw, index) => {
    if (insideRanges(index, exclude)) {
      return;
    }
    const match = /^\s*IdentityAgent(?:\s*=\s*|\s+)(.*)$/i.exec(normalizeLine(raw));
    if (match != null) {
      found.push({ line: raw, lineNumber: index + 1, value: unquote(match[1]) });
    }
  });
  return found;
}

/**
 * Finds lines outside our managed blocks that set or derive SSH_AUTH_SOCK: direct assignments,
 * `export`/`set -x` forms, and `eval` of ssh-agent/keychain/gpg output. Comments are ignored.
 */
export function findSshAuthSockAssignments(
  lines: string[],
  exclude: ManagedBlockRange[],
): FoundLine[] {
  const found: FoundLine[] = [];
  lines.forEach((raw, index) => {
    if (insideRanges(index, exclude)) {
      return;
    }
    const line = normalizeLine(raw);
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      return;
    }
    const posix = /^(?:export\s+)?SSH_AUTH_SOCK=(\S*)/.exec(trimmed);
    const fish = /^set\s+(?:-{1,2}[A-Za-z]+\s+)*SSH_AUTH_SOCK\s+(\S+)/.exec(trimmed);
    const evalsAgent =
      /\beval\b/.test(trimmed) && /\b(ssh-agent|keychain|gpg-agent|gpgconf)\b/.test(trimmed);
    if (posix != null || fish != null) {
      const value = posix?.[1] ?? fish?.[1] ?? "";
      found.push({ line: raw, lineNumber: index + 1, value: unquote(value.replace(/;$/, "")) });
    } else if (/\bSSH_AUTH_SOCK\b/.test(trimmed) || evalsAgent) {
      found.push({ line: raw, lineNumber: index + 1, value: null });
    }
  });
  return found;
}

/** Expands a leading `~/`, `$HOME/` or `${HOME}/` so values can be compared to an absolute path. */
export function expandHome(value: string, home: string): string {
  for (const prefix of ["~/", "$HOME/", "${HOME}/"]) {
    if (value.startsWith(prefix)) {
      return `${home}/${value.slice(prefix.length)}`;
    }
  }
  return value;
}

// C0/C1 controls, zero-width and bidi override characters, line/paragraph separators and BOM.
// Built from an escaped string: some transpilers emit U+2028 raw inside a regex literal.
const UNSAFE_DISPLAY_CHARS = new RegExp(
  // eslint-disable-next-line no-control-regex -- matching control characters is the purpose here.
  "[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]",
  "g",
);

/** Strips control characters and truncates a line before it is shown in the UI. */
export function sanitizeDisplayLine(line: string): string {
  return line.replace(UNSAFE_DISPLAY_CHARS, "").trim().slice(0, MAX_DISPLAY_LINE_LENGTH);
}
