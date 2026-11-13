import type { PamNames } from "@bitwarden/bit-common/pam/shared";
import type { AccessRequestView, CipherAccessStateView } from "@bitwarden/sdk-internal";

import { AccessRequestResponse, CipherAccessStateResponse } from "./request.response";

const hostile = (label: string) => `${label}\u001b[2K\u001b]0;x\u0007\u202e\r\n`;
const names: PamNames = {
  cipher: () => hostile("cipher"),
  collection: () => hostile("collection"),
  organization: () => hostile("org"),
};
const CONTROLS = /[\p{Cc}\u202e]/u;

describe("request responses", () => {
  it("strips control characters from the names of a request", () => {
    const view = {
      id: "r",
      cipherId: "c",
      collectionId: "col",
      organizationId: "o",
      status: "pending",
      awaitingActivation: false,
    } as unknown as AccessRequestView;
    const response = new AccessRequestResponse(view, names);
    expect(response.cipherName).toBe("cipher[2K]0;x");
    expect(response.organizationName).toBe("org[2K]0;x");
    expect(JSON.stringify(response)).not.toMatch(CONTROLS);
  });

  it("strips control characters from the cipher name of an access state", () => {
    const state = {
      cipherId: "c",
      badgeState: "none",
      extensionsAllowed: false,
    } as unknown as CipherAccessStateView;
    const response = new CipherAccessStateResponse(state, { names, nowMs: 0 });
    expect(response.cipherName).toBe("cipher[2K]0;x");
    expect(JSON.stringify(response)).not.toMatch(CONTROLS);
  });
});
