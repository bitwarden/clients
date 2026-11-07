// Name only: an import error's message can carry item names.
export const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : "unknown error";
