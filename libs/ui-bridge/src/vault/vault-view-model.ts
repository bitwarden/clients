/**
 * Presentation-only view-models for vault items.
 *
 * These types are the contract the redesigned UI renders against. They are a
 * thin, display-shaped projection of the decrypted `CipherView` produced by
 * @bitwarden/common's CipherService. The UI never sees an encrypted cipher and
 * never imports CipherService itself — it consumes these models from the bridge.
 *
 * NOTE: This file intentionally contains only types + a mapper signature. The
 * concrete Angular service implementation is added in Phase 3 (step C); it will
 * inject the real CipherService and map CipherView -> ItemViewModel. Kept as an
 * interface now so the UI can be built against a stable contract immediately.
 */

export type ItemKind = "login" | "card" | "identity" | "note";

export interface ItemSummary {
  id: string;
  kind: ItemKind;
  /** Display title (cipher.name). */
  title: string;
  /** Secondary line — e.g. username for logins, brand for cards. */
  subtitle?: string;
  favorite: boolean;
  organizationId?: string;
  /** Tag/collection ids for filtering in the sidebar. */
  tagIds: string[];
  /** Domain icon hint (host) — never a decrypted secret. */
  iconKey?: string;
  hasTotp: boolean;
  revisionDate: string;
}

export interface ItemDetail extends ItemSummary {
  /** Fields are only populated after the user opens an item (lazy reveal). */
  username?: string;
  /** Present only while revealed; copy goes through the bridge, not the UI. */
  password?: string;
  uris?: string[];
  notes?: string;
  /** Opaque TOTP seed handle — the UI asks the bridge for the *code*, not this. */
  totpAvailable: boolean;
}

/**
 * The view-model service contract. Implemented by an Angular @Injectable in
 * Phase 3 that wraps the real services. Signals/observables keep the UI reactive
 * without it knowing about RxJS internals of core.
 */
export interface VaultViewModel {
  /** Reactive, decrypted-at-the-edge list for the current account/filter. */
  items(): readonly ItemSummary[];
  /** Load full detail for one item (triggers reveal-time decryption in core). */
  getDetail(id: string): Promise<ItemDetail>;
  /** Persist an edit via the existing CipherService.save path (no raw API). */
  save(detail: ItemDetail): Promise<void>;
  /** Toggle favorite via the existing service. */
  toggleFavorite(id: string): Promise<void>;
}
