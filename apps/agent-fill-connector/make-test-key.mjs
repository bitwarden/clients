// Prints a random connection key in the desktop app's format (32 random bytes, base64url, 43
// characters) and its SHA-256 hex, for manual runs against a debug desktop build. The key is not
// saved anywhere.
import { createHash, randomBytes } from "node:crypto";

const key = randomBytes(32).toString("base64url");
console.log(`connection key (paste into Claude Desktop): ${key}`);
console.log(`sha256 hex: ${createHash("sha256").update(key, "utf8").digest("hex")}`);
