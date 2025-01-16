/* eslint no-console:0 */
import fs from "fs";
import path from "path";

type Messages = {
  [id: string]: {
    message: string;
  };
};

function findLocaleFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { encoding: null, recursive: true })
    .filter((file) => path.basename(file) === "messages.json")
    .filter((file) => path.dirname(file).endsWith("en"))
    .map((file) => path.join(dir, file));
}

function findAllLocaleFiles(rootDir: string): string[] {
  return [
    ...findLocaleFiles(path.join(rootDir, "apps", "browser", "src")),
    ...findLocaleFiles(path.join(rootDir, "apps", "cli", "src")),
    ...findLocaleFiles(path.join(rootDir, "apps", "desktop", "src")),
    ...findLocaleFiles(path.join(rootDir, "apps", "web", "src")),
  ].map((file) => path.relative(rootDir, file));
}

function readMessagesJson(file: string): Messages {
  let content = fs.readFileSync(file, { encoding: "utf-8" });
  // Strip BOM
  content = content.replace(/^\uFEFF/, "");
  try {
    return JSON.parse(content);
  } catch (e: unknown) {
    console.error(`ERROR: Invalid JSON file ${file}`, e);
    throw e;
  }
}

function compareMessagesJson(beforeFile: string, afterFile: string): boolean {
  try {
    console.log("Comparing locale files:", beforeFile, afterFile);

    const messagesBeforeJson = readMessagesJson(beforeFile);
    const messagesAfterJson = readMessagesJson(afterFile);

    const messagesIdMapBefore = toMessageIdMap(messagesBeforeJson);
    const messagesIdMapAfter = toMessageIdMap(messagesAfterJson);

    let changed = false;

    for (const [id, message] of messagesIdMapAfter.entries()) {
      if (!messagesIdMapBefore.has(id)) {
        console.log("New message:", id);
        continue;
      }

      if (messagesIdMapBefore.get(id) !== message) {
        console.error("ERROR: Message changed:", id);
        changed = true;
      }
    }

    return changed;
  } catch (e: unknown) {
    console.error(`ERROR: Unable to compare files ${beforeFile} and ${afterFile}`, e);
    throw e;
  }
}

function toMessageIdMap(messagesJson: Messages): Map<string, string> {
  return Object.entries(messagesJson).reduce((map, [id, value]) => {
    map.set(id, value.message);
    return map;
  }, new Map<string, string>());
}

const rootDir = path.join(__dirname, "..", "..");
const baseBranchRootDir = path.join(rootDir, "base");

const files = findAllLocaleFiles(rootDir);

console.log("Detected valid English locale files:", files);

let changedFiles = false;

for (const file of files) {
  const baseBranchFile = path.join(baseBranchRootDir, file);
  if (!fs.existsSync(baseBranchFile)) {
    console.error("ERROR: File not found in base branch:", file);
    continue;
  }

  const changed = compareMessagesJson(baseBranchFile, path.join(rootDir, file));
  changedFiles ||= changed;
}

if (changedFiles) {
  console.error(
    "ERROR: Incompatible Crowdin locale files. " +
      "All messages in messages.json locale files needs to be immutable and cannot be updated. " +
      "If a message needs to be changed, create a new message id and update your code to use it instead.",
  );
  process.exit(1);
}
