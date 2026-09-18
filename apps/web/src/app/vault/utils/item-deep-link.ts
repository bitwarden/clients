import { ParamMap } from "@angular/router";

import { CipherId, isId } from "@bitwarden/common/types/guid";

/** The `?action=` values the vault's item deep link accepts. */
export const ItemDeepLinkAction = Object.freeze({
  View: "view",
  Edit: "edit",
  Clone: "clone",
  ShowFailedToDecrypt: "showFailedToDecrypt",
} as const);

export type ItemDeepLinkAction = (typeof ItemDeepLinkAction)[keyof typeof ItemDeepLinkAction];

export function isItemDeepLinkAction(value: unknown): value is ItemDeepLinkAction {
  return Object.values(ItemDeepLinkAction).some((action) => action === value);
}

/** An item the URL asks the vault to open, and how to open it. */
export type ItemDeepLink = {
  cipherId: CipherId;
  action: ItemDeepLinkAction;
};

/**
 * Reads the `?itemId=&action=` deep link out of a URL's query params, or `undefined` when the URL
 * names no item.
 *
 * `cipherId` is the param's original name, still honored for links written before it became
 * `itemId`. An absent or unrecognized action reads as `view`: a link that names an item but no
 * action opens it read-only. A value that is not a guid names no item, so it reads as no deep
 * link rather than as a lookup that is certain to miss.
 */
export function itemDeepLinkFrom(params: ParamMap | undefined): ItemDeepLink | undefined {
  const cipherId = params?.get("itemId") ?? params?.get("cipherId");
  if (!isId<CipherId>(cipherId)) {
    return undefined;
  }

  const action = params?.get("action");
  return {
    cipherId,
    action: isItemDeepLinkAction(action) ? action : ItemDeepLinkAction.View,
  };
}
