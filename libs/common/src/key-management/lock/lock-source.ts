import { UnionOfValues } from "../../vault/types/union-of-values";

/**
 * Why a lock was initiated.
 *
 * Consumers of {@link LockService.registerOnLockAction} use this to avoid reacting to locks they
 * caused themselves. Shared unlock, for instance, ignores {@link LockSource.SharedUnlock} so that a
 * lock propagated from another device is not broadcast straight back out.
 */
export const LockSource = Object.freeze({
  /** The vault timeout elapsed, or a system idle/lock event mapped to the vault-timeout action. */
  VaultTimeout: "vaultTimeout",
  /** The user explicitly locked, e.g. through a menu, keyboard shortcut, or the CLI. */
  Manual: "manual",
  /** Another device locked, and shared unlock propagated that lock into this client. */
  SharedUnlock: "sharedUnlock",
} as const);

export type LockSource = UnionOfValues<typeof LockSource>;

/** Whether the value is a valid {@link LockSource}. */
export function isLockSource(value: unknown): value is LockSource {
  const sources: unknown[] = Object.values(LockSource);
  return sources.includes(value);
}

/**
 * Converts an untyped value, such as an extension message payload, to a {@link LockSource}.
 *
 * @returns The lock source, or `undefined` when the value is not one.
 */
export function toLockSource(value: unknown): LockSource | undefined {
  return isLockSource(value) ? value : undefined;
}
