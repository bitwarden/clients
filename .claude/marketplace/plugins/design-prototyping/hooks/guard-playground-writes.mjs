// PreToolUse hook: inside bitwarden/clients, only allow file edits in the design playground.
// Edits outside the repo (e.g. scratch files in /tmp) are left to the normal permission flow.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const PLAYGROUND = join("libs", "components", "src", "stories", "playground");

const input = JSON.parse(readFileSync(0, "utf8"));
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;

if (!projectDir || !filePath || !existsSync(join(projectDir, PLAYGROUND))) {
  process.exit(0);
}

const root = realpathSync(projectDir);
const target = canonicalize(resolve(projectDir, filePath));
const playground = join(root, PLAYGROUND);

const insideRepo = !relative(root, target).startsWith("..");
const insidePlayground = target === playground || target.startsWith(playground + sep);

if (insideRepo && !insidePlayground) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Prototypes may only change files in ${PLAYGROUND}. Compose existing components there instead of editing library or app source.`,
      },
    }),
  );
}

// Resolves symlinks and `..` for paths whose leaf may not exist yet.
function canonicalize(path) {
  if (existsSync(path)) {
    return realpathSync(path);
  }
  const parent = dirname(path);
  return parent === path ? path : join(canonicalize(parent), path.slice(parent.length + 1));
}
