export type ReferenceId = number;

export type PropertySymbol = keyof typeof PropertySymbolMap;
export type SerializedPropertySymbol = (typeof PropertySymbolMap)[keyof typeof PropertySymbolMap];

export type BatchCommand =
  | { method: "get"; propertyName: string }
  | { method: "get"; propertySymbol: SerializedPropertySymbol }
  | { method: "apply"; args: unknown[] }
  | { method: "await" }
  | { method: "transfer" };

export type Command =
  | { method: "get"; referenceId: ReferenceId; propertyName: string }
  | { method: "get"; referenceId: ReferenceId; propertySymbol: SerializedPropertySymbol }
  | { method: "call"; referenceId: ReferenceId; propertyName: string; args: unknown[] }
  | {
      method: "call";
      referenceId: ReferenceId;
      propertySymbol: SerializedPropertySymbol;
      args: unknown[];
    }
  | { method: "batch"; referenceId: ReferenceId; commands: BatchCommand[] }
  | { method: "by_value"; referenceId: ReferenceId }
  | { method: "release"; referenceId: ReferenceId };

export type Response = { status: "success"; result: Result } | { status: "error"; error: unknown };

export type Result =
  | { type: "value"; value: unknown }
  | { type: "reference"; referenceId: ReferenceId; objectType?: string };
// | { type: "rc", referenceId: ReferenceId, objectType?: string };

// A list of supported property symbols and their wire names
const PropertySymbolMap = {
  [Symbol.asyncDispose]: "asyncDispose",
} as const;

// Build reverse lookup that includes symbol keys (Object.entries omits symbols)
const SymbolToString = new Map<symbol, SerializedPropertySymbol>([
  [Symbol.asyncDispose, PropertySymbolMap[Symbol.asyncDispose]],
]);
const StringToSymbol = new Map<SerializedPropertySymbol, symbol>([
  [PropertySymbolMap[Symbol.asyncDispose], Symbol.asyncDispose],
]);

export function deserializeSymbol(name: SerializedPropertySymbol): symbol {
  const sym = StringToSymbol.get(name as SerializedPropertySymbol);
  if (!sym) {
    throw new Error(`Unsupported property symbol: ${name}. This property cannot be used over RPC.`);
  }
  return sym;
}

export function serializeSymbol(symbol: PropertySymbol): SerializedPropertySymbol {
  const value = SymbolToString.get(symbol as unknown as symbol);
  if (!value) {
    throw new Error(`Unsupported serialized property symbol: ${String(symbol)}`);
  }
  return value;
}
