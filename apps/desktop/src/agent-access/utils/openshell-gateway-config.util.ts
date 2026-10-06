import { OpenShellSnippetInput, buildOpenShellSnippet } from "./openshell-config-snippet.util";

/** The credential driver's name inside `gateway.toml`, and the entry in `credential_drivers`. */
const DRIVER_NAME = "bitwarden";

const GATEWAY_TABLE = "openshell.gateway";
const DRIVER_TABLE = `openshell.credential_drivers.${DRIVER_NAME}`;

export type GatewayConfigEdit =
  { kind: "ok"; content: string; changed: boolean } | { kind: "unmergeable"; reason: string };

interface Section {
  /** Table name from the header, or `null` for the lines before the first header. */
  name: string | null;
  /** Index of the header line in `lines`, or `-1` for the preamble. */
  headerIndex: number;
  /** One past the last line of the section (the next header, or the end of the file). */
  end: number;
}

// A table header: `[a.b]` with optional trailing comment. Array tables (`[[x]]`) are not matched
// here; `isAnyHeader` treats them as section boundaries so a table is never extended past one.
const TABLE_HEADER = /^\s*\[([^[\]]+)\]\s*(?:#.*)?$/;
const isAnyHeader = (line: string) => /^\s*\[/.test(line);

function tableName(line: string): string | null {
  const match = TABLE_HEADER.exec(line);
  return match == null ? null : match[1].replace(/\s+/g, "");
}

function splitSections(lines: string[]): Section[] {
  const sections: Section[] = [{ name: null, headerIndex: -1, end: lines.length }];
  lines.forEach((line, index) => {
    if (isAnyHeader(line)) {
      sections[sections.length - 1].end = index;
      sections.push({ name: tableName(line), headerIndex: index, end: lines.length });
    }
  });
  return sections;
}

function findSection(sections: Section[], name: string): Section | undefined {
  return sections.find((section) => section.name === name);
}

/** `credential_drivers = ["a", "b"]  # note` → its items and the trailing comment, or `null` when
 *  the value is not a single-line array of plain strings (multi-line, inline table, …). */
function parseDriverArray(line: string): { items: string[]; comment: string } | null {
  const match = /^(\s*credential_drivers\s*=\s*)\[(.*)\]\s*(#.*)?$/.exec(line);
  if (match == null) {
    return null;
  }
  const body = match[2].trim();
  const items: string[] = [];
  if (body.length > 0) {
    // Only double- or single-quoted strings separated by commas; anything else is not ours to
    // rewrite.
    const itemPattern = /^\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:,|$)/;
    let rest = body;
    while (rest.trim().length > 0) {
      const item = itemPattern.exec(rest);
      if (item == null) {
        return null;
      }
      items.push(item[1] ?? item[2]);
      rest = rest.slice(item[0].length);
    }
  }
  return { items, comment: match[3] ?? "" };
}

function formatDriverArray(items: string[], comment: string): string {
  const quoted = items.map((item) => `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `credential_drivers = [${quoted.join(", ")}]${comment === "" ? "" : `  ${comment}`}`;
}

/** Whether `openshell.gateway` or the driver table could be defined by a form this editor does not
 *  understand (dotted keys under `[openshell]`, an inline table, …). Editing around such a
 *  definition would produce a duplicate key, which is a parse error for the gateway. */
function hasUnsupportedDefinition(lines: string[], sections: Section[]): string | null {
  const root = findSection(sections, "openshell");
  if (root != null) {
    for (let i = root.headerIndex + 1; i < root.end; i++) {
      if (/^\s*(gateway|credential_drivers)\s*[.=]/.test(lines[i])) {
        return "gateway.toml defines the gateway settings inline under [openshell]";
      }
    }
  }
  const drivers = findSection(sections, "openshell.credential_drivers");
  if (drivers != null) {
    for (let i = drivers.headerIndex + 1; i < drivers.end; i++) {
      if (new RegExp(`^\\s*${DRIVER_NAME}\\s*[.=]`).test(lines[i])) {
        return "gateway.toml defines the Bitwarden driver inline under [openshell.credential_drivers]";
      }
    }
  }
  const gatewayHeaders = sections.filter((section) => section.name === GATEWAY_TABLE).length;
  const driverHeaders = sections.filter((section) => section.name === DRIVER_TABLE).length;
  if (gatewayHeaders > 1 || driverHeaders > 1) {
    return "gateway.toml has a duplicate table";
  }
  return null;
}

function driverBody(input: OpenShellSnippetInput): string[] | null {
  const snippet = buildOpenShellSnippet(input);
  if (snippet == null) {
    return null;
  }
  const lines = snippet.gatewayToml.split("\n");
  const start = lines.indexOf(`[openshell.credential_drivers.${DRIVER_NAME}]`);
  return lines.slice(start + 1).filter((line) => line.length > 0);
}

function toContent(lines: string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

/** End (exclusive) of a table's own lines: its section minus any trailing blank or comment lines,
 *  which belong to whatever table follows. */
function ownEnd(lines: string[], section: Section): number {
  let end = section.end;
  while (
    end > section.headerIndex + 1 &&
    (lines[end - 1].trim() === "" || lines[end - 1].trim().startsWith("#"))
  ) {
    end--;
  }
  return end;
}

function trimTrailingBlank(lines: string[]) {
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
}

/**
 * Adds the Bitwarden credential driver to the text of a `gateway.toml` (`null` when the file does
 * not exist yet). A surgical text edit rather than a parse-and-reserialize, so comments, ordering
 * and every other table survive. Idempotent: merging into an already-merged file changes nothing.
 *
 * Refuses (`unmergeable`) rather than guessing when the file defines these settings in a form this
 * editor doesn't understand; the caller then falls back to showing the snippet.
 */
export function mergeGatewayConfig(
  existing: string | null,
  input: OpenShellSnippetInput,
): GatewayConfigEdit {
  const body = driverBody(input);
  if (body == null) {
    return { kind: "unmergeable", reason: "a path contains a control character" };
  }

  const lines =
    existing == null || existing === "" ? [] : existing.replace(/\r\n/g, "\n").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  let sections = splitSections(lines);
  const unsupported = hasUnsupportedDefinition(lines, sections);
  if (unsupported != null) {
    return { kind: "unmergeable", reason: unsupported };
  }

  // 1. The driver table: replace its body, or append the whole table.
  const driver = findSection(sections, DRIVER_TABLE);
  if (driver != null) {
    lines.splice(driver.headerIndex + 1, ownEnd(lines, driver) - driver.headerIndex - 1, ...body);
  } else {
    trimTrailingBlank(lines);
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(`[${DRIVER_TABLE}]`, ...body);
  }

  // 2. The gateway table's `credential_drivers` list.
  sections = splitSections(lines);
  const gateway = findSection(sections, GATEWAY_TABLE);
  if (gateway == null) {
    trimTrailingBlank(lines);
    if (lines.length > 0) {
      lines.push("");
    }
    // Before the driver table when that was just appended, for a readable file.
    const driverAt = lines.indexOf(`[${DRIVER_TABLE}]`);
    const block = [`[${GATEWAY_TABLE}]`, formatDriverArray([DRIVER_NAME], ""), ""];
    if (driverAt >= 0 && driver == null) {
      lines.splice(driverAt, 0, ...block);
    } else {
      lines.push(...block.slice(0, 2));
    }
  } else {
    const keyLines: number[] = [];
    for (let i = gateway.headerIndex + 1; i < gateway.end; i++) {
      if (/^\s*credential_drivers\s*=/.test(lines[i])) {
        keyLines.push(i);
      }
    }
    if (keyLines.length > 1) {
      return { kind: "unmergeable", reason: "credential_drivers is defined more than once" };
    }
    if (keyLines.length === 0) {
      lines.splice(gateway.headerIndex + 1, 0, formatDriverArray([DRIVER_NAME], ""));
    } else {
      const parsed = parseDriverArray(lines[keyLines[0]]);
      if (parsed == null) {
        return {
          kind: "unmergeable",
          reason: "credential_drivers is not a single-line list of strings",
        };
      }
      if (!parsed.items.includes(DRIVER_NAME)) {
        lines[keyLines[0]] = formatDriverArray([...parsed.items, DRIVER_NAME], parsed.comment);
      }
    }
  }

  const content = toContent(lines);
  const normalizedExisting = existing?.replace(/\r\n/g, "\n") ?? null;
  return { kind: "ok", content, changed: content !== normalizedExisting };
}

/**
 * The inverse of `mergeGatewayConfig`: drops the Bitwarden driver table and its entry in
 * `credential_drivers`, leaving every other setting as it was.
 */
export function removeFromGatewayConfig(existing: string): GatewayConfigEdit {
  const lines = existing.replace(/\r\n/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  let sections = splitSections(lines);
  const unsupported = hasUnsupportedDefinition(lines, sections);
  if (unsupported != null) {
    return { kind: "unmergeable", reason: unsupported };
  }

  const gateway = findSection(sections, GATEWAY_TABLE);
  if (gateway != null) {
    for (let i = gateway.headerIndex + 1; i < gateway.end; i++) {
      if (!/^\s*credential_drivers\s*=/.test(lines[i])) {
        continue;
      }
      const parsed = parseDriverArray(lines[i]);
      if (parsed == null) {
        return {
          kind: "unmergeable",
          reason: "credential_drivers is not a single-line list of strings",
        };
      }
      const remaining = parsed.items.filter((item) => item !== DRIVER_NAME);
      if (remaining.length === 0) {
        lines.splice(i, 1);
      } else {
        lines[i] = formatDriverArray(remaining, parsed.comment);
      }
      break;
    }
  }

  sections = splitSections(lines);
  const driver = findSection(sections, DRIVER_TABLE);
  if (driver != null) {
    const end = ownEnd(lines, driver);
    // Take one blank line with the table so removal doesn't leave a double gap.
    const start =
      lines[driver.headerIndex - 1]?.trim() === "" ? driver.headerIndex - 1 : driver.headerIndex;
    lines.splice(start, end - start);
  }
  // An `[openshell.gateway]` left with nothing in it is ours to drop too; one with other settings
  // (or comments) is not.
  sections = splitSections(lines);
  const emptied = findSection(sections, GATEWAY_TABLE);
  if (
    emptied != null &&
    lines.slice(emptied.headerIndex + 1, emptied.end).every((line) => line.trim() === "")
  ) {
    lines.splice(emptied.headerIndex, emptied.end - emptied.headerIndex);
  }

  trimTrailingBlank(lines);
  const content = toContent(lines);
  return { kind: "ok", content, changed: content !== existing.replace(/\r\n/g, "\n") };
}

/** Whether `content` already has the driver table pointing at exactly `input`, and the gateway
 *  listing it. Used for the "set up" status, so a stale `command` path reads as needing setup. */
export function isGatewayConfigCurrent(content: string, input: OpenShellSnippetInput): boolean {
  const merged = mergeGatewayConfig(content, input);
  return merged.kind === "ok" && !merged.changed;
}
