import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { mockContainerService } from "../../../../../spec";
import { SendItemData } from "../data/send-item.data";

import { SendItem } from "./send-item";

/** Opaque sealed cipher blob; clients pass it through unchanged. */
const SEALED_DATA = '{"format_version":1,"wrapped_cek":"2.a|b|c","envelope":"g1hH"}';
const ITEM_ID = "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71";

describe("SendItem", () => {
  let data: SendItemData;

  beforeEach(() => {
    data = {
      data: SEALED_DATA,
      encryptionVersion: SendEncryptionType.V1,
      metadata: { itemId: ITEM_ID },
    };

    mockContainerService();
  });

  it("Convert", () => {
    const sendItem = new SendItem(data);

    expect(sendItem).toEqual({
      encryptionVersion: SendEncryptionType.V1,
      data: SEALED_DATA,
      metadata: { itemId: ITEM_ID },
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

  it("throws when mapping to the SDK without metadata", () => {
    const sendItem = new SendItem({ ...data, metadata: undefined });

    expect(() => sendItem.toSdk()).toThrow("Item Send is missing its item metadata");
  });
});
