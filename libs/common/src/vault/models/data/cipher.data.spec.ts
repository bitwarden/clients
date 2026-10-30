import { CipherType } from "../../enums/cipher-type";
import { CipherResponse } from "../response/cipher.response";

import { CipherData } from "./cipher.data";

describe("CipherData", () => {
  it("copies ExcludedFromReports from the response", () => {
    const response = new CipherResponse({
      Id: "cipher-id",
      Type: CipherType.SecureNote,
      SecureNote: { Type: 0 },
      ExcludedFromReports: true,
    });

    expect(new CipherData(response).excludedFromReports).toBe(true);
  });
});
