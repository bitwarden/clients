import { SendType } from "../../types/send-type";

import { SendAccessResponse } from "./send-access.response";

describe("SendAccessResponse", () => {
  it("passes Item Send metadata to the SDK", () => {
    const response = new SendAccessResponse({
      Type: SendType.Item,
      Data: {
        EncryptionVersion: 1,
        Data: "sealed",
        Metadata: { ItemId: "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71" },
      },
    });

    const sdk = SendAccessResponse.toSdkAccessResponse(response);

    expect(sdk.data?.metadata).toEqual({ itemId: "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71" });
  });
});
