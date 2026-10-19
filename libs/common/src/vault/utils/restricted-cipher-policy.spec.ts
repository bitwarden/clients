import { CipherListView } from "@bitwarden/sdk-internal";

import { CipherType } from "../enums";
import { Cipher } from "../models/domain/cipher";
import { CipherView } from "../models/view/cipher.view";
import { CipherLike } from "../types/cipher-like";

import { RestrictedCipherAction, RestrictedCipherPolicy } from "./restricted-cipher-policy";

describe("RestrictedCipherPolicy", () => {
  const allActions = Object.values(RestrictedCipherAction);
  const blockedActions = allActions.filter((a) => a !== RestrictedCipherAction.UserFields);

  const restrictedCipherView = () => {
    const view = new CipherView();
    view.type = CipherType.Login;
    view.partial = true;
    return view;
  };

  const restrictedListView = () =>
    ({ type: "secureNote", partial: true }) as unknown as CipherListView;

  const restrictedCipher = () => {
    const cipher = new Cipher();
    cipher.partialData = "{}";
    return cipher;
  };

  describe.each<[string, () => CipherLike]>([
    ["CipherView", restrictedCipherView],
    ["CipherListView", restrictedListView],
    ["Cipher", restrictedCipher],
  ])("a restricted %s", (_, create) => {
    it("is restricted", () => {
      expect(RestrictedCipherPolicy.isRestricted(create())).toBe(true);
    });

    it("allows user fields", () => {
      expect(RestrictedCipherPolicy.allows(create(), RestrictedCipherAction.UserFields)).toBe(true);
    });

    it.each(blockedActions)("blocks %s", (action) => {
      expect(RestrictedCipherPolicy.allows(create(), action)).toBe(false);
    });
  });

  describe.each<[string, () => CipherLike]>([
    ["CipherView", () => new CipherView()],
    ["CipherListView", () => ({ type: "secureNote" }) as CipherListView],
    ["Cipher", () => new Cipher()],
  ])("an unrestricted %s", (_, create) => {
    it("is not restricted", () => {
      expect(RestrictedCipherPolicy.isRestricted(create())).toBe(false);
    });

    it.each(allActions)("allows %s", (action) => {
      expect(RestrictedCipherPolicy.allows(create(), action)).toBe(true);
    });
  });

  describe("a revealed cipher", () => {
    const revealedAllowed: RestrictedCipherAction[] = [
      RestrictedCipherAction.UserFields,
      RestrictedCipherAction.Edit,
      RestrictedCipherAction.Attachments,
    ];
    const revealedBlocked = allActions.filter((a) => !revealedAllowed.includes(a));
    const revealedView = new CipherView();

    describe.each<[string, () => CipherLike]>([
      ["restricted CipherView", restrictedCipherView],
      ["restricted CipherListView", restrictedListView],
      ["restricted Cipher", restrictedCipher],
      ["revealed view itself", () => revealedView],
    ])("checked on the %s", (_, create) => {
      it.each(revealedAllowed)("allows %s", (action) => {
        expect(RestrictedCipherPolicy.allows(create(), action, revealedView)).toBe(true);
      });

      it.each(revealedBlocked)("blocks %s", (action) => {
        expect(RestrictedCipherPolicy.allows(create(), action, revealedView)).toBe(false);
      });
    });

    it.each(allActions)(
      "allows %s on a cipher that is no longer restricted while its reveal is held",
      (action) => {
        expect(RestrictedCipherPolicy.allows(new CipherView(), action, revealedView)).toBe(true);
      },
    );
  });
});
