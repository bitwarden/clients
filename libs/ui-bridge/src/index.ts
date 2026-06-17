/**
 * @klappstuhl/ui-bridge — FORK adapter layer.
 *
 * This is the ONLY library in the fork allowed to import @bitwarden/common,
 * @bitwarden/vault, @bitwarden/key-management, etc. It wraps those services and
 * exposes UI-friendly, presentation-only view-models.
 *
 * HARD RULES (see docs/ui-redesign/05-COMPATIBILITY-RISKS.md):
 *  - NEVER re-implement crypto, sync, auth, or API payloads here. Delegate to the
 *    existing services. This file is plumbing, not logic.
 *  - NEVER construct raw Vaultwarden/Bitwarden API requests. Mutations go through
 *    the existing service methods (e.g. CipherService.encrypt/save).
 *  - Decryption happens inside the wrapped services, exactly as today. The bridge
 *    only re-shapes already-decrypted view data for display.
 */

export * from "./vault/vault-view-model";
export * from "./vault/vault-view-model.service";
export * from "./vault/copy.service";
export * from "./vault/password-strength.service";
export * from "./auth/lock.service";
