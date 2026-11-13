import { SendItemView } from "@bitwarden/common/tools/send/models/view/send-item.view";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { getSendItemIcon } from "./send-item-icon";

function itemSend(cipherType: CipherType | undefined): SendView {
  const send = new SendView();
  send.type = SendType.Item;
  if (cipherType !== undefined) {
    const data = new SendItemView();
    data.data = new CipherView();
    data.data.type = cipherType;
    send.data = data;
  }
  return send;
}

describe("getSendItemIcon", () => {
  it.each([
    [CipherType.Login, "bwi-lock"],
    [CipherType.Card, "bwi-credit-card"],
    [CipherType.Identity, "bwi-user"],
    [CipherType.SecureNote, "bwi-sticky-note"],
    [CipherType.SshKey, "bwi-key"],
  ])("returns the icon for cipher type %p", (cipherType, icon) => {
    expect(getSendItemIcon(itemSend(cipherType))).toBe(icon);
  });

  it("returns undefined when the Send carries no item", () => {
    expect(getSendItemIcon(itemSend(undefined))).toBeUndefined();
  });
});
