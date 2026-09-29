import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { mockContainerService } from "../../../../../spec";
import { SendItemData } from "../data/send-item.data";

import { SendItem } from "./send-item";

/** Opaque sealed cipher blob; clients pass it through unchanged. */
const SEALED_DATA = '{"format_version":1,"wrapped_cek":"2.a|b|c","envelope":"g1hH"}';

describe("SendItem", () => {
  let data: SendItemData;

  beforeEach(() => {
    data = {
      data: SEALED_DATA,
      encryptionVersion: SendEncryptionType.V1,
    };

    mockContainerService();
  });

  it("Convert", () => {
    const sendItem = new SendItem(data);

    expect(sendItem).toEqual({
      encryptionVersion: SendEncryptionType.V1,
      data: SEALED_DATA,
    });
  });

  it("passes the sealed data through unchanged", () => {
    const sendItem = new SendItem(data);

    expect(sendItem.toSendData()).toEqual(data);
    expect(sendItem.toSdk()).toEqual(data);
    expect(SendItem.fromSdk(sendItem.toSdk())).toEqual(sendItem);
  });

  it("throws when mapping to the SDK without data", () => {
    expect(() => new SendItem().toSdk()).toThrow();
  });
});
