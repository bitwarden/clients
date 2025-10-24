export type ReferenceId = number;

export type Command =
  | { method: "get"; referenceId: ReferenceId; propertyName: string }
  | { method: "call"; referenceId: ReferenceId; propertyName: string; args: unknown[] }
  | { method: "release"; referenceId: ReferenceId };

export type Response = { status: "success"; result: Result } | { status: "error"; error: unknown };

export type Result =
  | { type: "value"; value: unknown }
  | { type: "reference"; referenceId: ReferenceId; objectType?: string };
