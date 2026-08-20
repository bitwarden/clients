/** Deep async stacks are mostly framework noise past this point. */
const MAX_STACK_LENGTH = 200;

/**
 * Converts an arbitrary log argument into a string for storage in a
 * {@link LogRecorder}, without ever throwing.
 *
 * - `undefined` becomes an empty string so callers can drop it.
 * - Primitives go through `String`.
 * - An `Error` becomes `name: message` plus its stack, capped at {@link MAX_STACK_LENGTH}.
 * - `Map`, `Set`, `BigInt` and binary buffers are converted so they serialize.
 *   Buffers keep only their type and size.
 * - Class instances are prefixed with their constructor name: `Foo {"a":1}`.
 * - Anything left unserializable falls back to `[object Tag]`.
 */
export function safeStringify(value: any): string {
  if (value === undefined) {
    return "";
  }

  const compact = compactString(value);
  if (compact !== undefined) {
    return compact;
  }

  if (value === null || typeof value !== "object") {
    return String(value);
  }

  try {
    const json = JSON.stringify(value, unwrap);
    if (json == null) {
      return Object.prototype.toString.call(value);
    }

    const name = className(value);
    return name == null ? json : `${name} ${json}`;
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/** The constructor name, or `null` when it adds nothing to the serialized shape. */
function className(value: object): string | null {
  const name = value.constructor?.name;
  return name == null || name === "Object" || name === "Array" ? null : name;
}

/** `JSON.stringify` replacer for the values it handles badly. */
function unwrap(this: any, key: string, value: any): any {
  // `value` has already been through `toJSON`, which disguises a `Buffer` as a
  // plain array of bytes. Read the original off the holder instead.
  const raw = this?.[key] ?? value;

  if (raw instanceof Map) {
    return Object.fromEntries(raw);
  }

  if (raw instanceof Set) {
    return Array.from(raw);
  }

  // Falls through to `value` so a useful `toJSON`, like `Date`, still wins.
  return compactString(raw) ?? value;
}

/**
 * String form shared by the root and nested paths, so both agree. `undefined`
 * when the value should be serialized structurally instead.
 */
function compactString(value: any): string | undefined {
  if (typeof value === "bigint") {
    return `${value}`;
  }

  if (value instanceof Error) {
    return errorText(value);
  }

  // Size only: buffer contents are never safe to export.
  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}(${value.byteLength})`;
  }

  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer(${value.byteLength})`;
  }

  return undefined;
}

function errorText(error: Error): string {
  const text = `${error.name}: ${error.message}`;
  if (!error.stack) {
    return text;
  }

  // V8 repeats `name: message` at the head of the stack; other engines do not.
  const frames = error.stack.startsWith(text) ? error.stack.slice(text.length) : `\n${error.stack}`;

  return `${text}${frames.slice(0, MAX_STACK_LENGTH)}`;
}
