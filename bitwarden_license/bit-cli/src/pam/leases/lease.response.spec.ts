import type { AccessLeaseView } from "@bitwarden/sdk-internal";

import { LeaseResponse } from "./lease.response";

describe("LeaseResponse", () => {
  it("strips escape and control characters from the cipher name", () => {
    const lease = { id: "l", requestId: "r", cipherId: "c", collectionId: "col", status: "active" };
    const response = new LeaseResponse(
      lease as unknown as AccessLeaseView,
      "Prod\u001b[2K\r\u001b[31mfake\u202e row\u0007",
    );
    expect(response.cipherName).toBe("Prod[2K [31mfake row");
    expect(JSON.stringify(response)).not.toMatch(/[\p{Cc}\u202e]/u);
  });

  it("leaves the name absent without --names", () => {
    const lease = { id: "l", requestId: "r", cipherId: "c", collectionId: "col", status: "active" };
    expect(new LeaseResponse(lease as unknown as AccessLeaseView).cipherName).toBeUndefined();
  });
});
