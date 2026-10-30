import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DIALOG_CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { BitwardenIcon } from "@bitwarden/components";

/**
 * Icon for each cipher type, taken from the same menu items the new item dialog and add-item
 * grid use, so an Item Send shows the same icon as the item it wraps.
 */
const ITEM_SEND_ICONS = new Map<CipherType, BitwardenIcon>(
  DIALOG_CIPHER_MENU_ITEMS.map((item) => [item.type, item.icon as BitwardenIcon]),
);

/**
 * Returns the icon for the cipher an Item Send wraps. Returns `undefined if there is no
 * item or if it is of a type that has no add menu entry yet.
 */
export function getSendItemIcon(send: SendView): BitwardenIcon | undefined {
  if (send.data?.data == null) {
    return undefined;
  }
  return ITEM_SEND_ICONS.get(send.data.data.type);
}
