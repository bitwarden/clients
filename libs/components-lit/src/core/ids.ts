let nextId = 0;

/** Returns a document-unique id for ARIA relationships. */
export function uniqueId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}
