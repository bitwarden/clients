import { ProviderToken } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import {
  CIPHER_VIEW_BANNER,
  ITEM_DETAILS_BADGE,
  VAULT_ITEM_COLUMN,
  VAULT_ITEM_FILTER,
  VAULT_ROW_ACTIONS,
} from "@bitwarden/vault";

import { VAULT_GATED_COLLECTION_BANNER } from "./vault-gated-collection-banner.token";

/**
 * The OSS desktop vault never imports PAM. Every PAM surface is an optional token that the
 * commercial build fills, so with nothing provided each one reads as absent and the vault renders
 * as it did before PAM.
 */
describe("desktop vault PAM seams", () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  const seams: [string, ProviderToken<unknown>][] = [
    ["VAULT_GATED_COLLECTION_BANNER", VAULT_GATED_COLLECTION_BANNER],
    ["VAULT_ROW_ACTIONS", VAULT_ROW_ACTIONS],
    ["VAULT_ITEM_COLUMN", VAULT_ITEM_COLUMN],
    ["VAULT_ITEM_FILTER", VAULT_ITEM_FILTER],
    ["CIPHER_VIEW_BANNER", CIPHER_VIEW_BANNER],
    ["ITEM_DETAILS_BADGE", ITEM_DETAILS_BADGE],
  ];

  it.each(seams)("leaves %s unprovided in an OSS build", (_name, token) => {
    expect(TestBed.inject(token, null, { optional: true })).toBeNull();
  });
});
