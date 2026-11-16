import { CipherType } from "@bitwarden/common/vault/enums";

export type ItemTypeCounts = Partial<Record<CipherType, number>>;

export function countCipherTypes(ciphers: readonly { type: CipherType }[]): ItemTypeCounts {
  const counts: ItemTypeCounts = {};
  for (const { type } of ciphers) {
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/** The items left once every item of the `removed` types is taken out. */
export function countAfterRemoval(counts: ItemTypeCounts, removed: Iterable<CipherType>): number {
  const removedTypes = new Set<number>(removed);
  return Object.entries(counts).reduce(
    (total, [type, count]) => (removedTypes.has(Number(type)) ? total : total + count),
    0,
  );
}
