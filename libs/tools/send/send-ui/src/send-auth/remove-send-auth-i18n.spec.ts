import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";

import { removeSendAuthI18nKeys } from "./remove-send-auth-i18n";

describe("removeSendAuthI18nKeys", () => {
  it("returns password keys for password-protected Sends", () => {
    expect(removeSendAuthI18nKeys(AuthType.Password)).toEqual({
      label: "removePassword",
      confirmation: "removeSendPasswordConfirmation",
      removed: "removedPassword",
    });
  });

  it("returns email verification keys for email-verified Sends", () => {
    expect(removeSendAuthI18nKeys(AuthType.Email)).toEqual({
      label: "removeEmailVerification",
      confirmation: "removeSendEmailVerificationConfirmation",
      removed: "removedEmailVerification",
    });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["None", AuthType.None],
  ])("falls back to the generic keys when the auth type is %s", (_, authType) => {
    expect(removeSendAuthI18nKeys(authType)).toEqual({
      label: "removeAuth",
      confirmation: "removeAuthConfirmation",
      removed: "removedAuth",
    });
  });
});
