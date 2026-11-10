import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { SendItemData } from "../data/send-item.data";

import { SendItem } from "./send-item";

/** Stand-in for the opaque sealed cipher blob the SDK produces. */
const SEALED_DATA = '{"format_version":1,"wrapped_cek":"2.a|b|c","envelope":"g1hH"}';
const ITEM_ID = "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71";

describe("SendItem", () => {
  let data: SendItemData;
  const now = new Date();

  beforeEach(() => {
    data = {
      data: SEALED_DATA,
      encryptionVersion: SendEncryptionType.V1,
      metadata: {
        itemId: ITEM_ID,
        creationDate: now.toISOString(),
        revisionDate: now.toISOString(),
      },
    };
  });

  it("Convert", () => {
    const sendItem = new SendItem(data);

    expect(sendItem).toEqual({
      encryptionVersion: SendEncryptionType.V1,
      data: SEALED_DATA,
      metadata: {
        itemId: ITEM_ID,
        creationDate: now.toISOString(),
        revisionDate: now.toISOString(),
      },
    });
  });

  it("passes the sealed data and metadata through unchanged", () => {
    const sendItem = new SendItem(data);

    expect(sendItem.toSendData()).toEqual(data);
    expect(sendItem.toSdk()).toEqual(data);
    expect(SendItem.fromSdk(sendItem.toSdk())).toEqual(sendItem);
  });

  it("round-trips through JSON", () => {
    const sendItem = new SendItem(data);

    expect(SendItem.fromJSON(JSON.parse(JSON.stringify(sendItem)))).toEqual(sendItem);
  });

  it("throws when mapping to the SDK without data", () => {
    const sendItem = new SendItem({ ...data, data: undefined });

    expect(() => sendItem.toSdk()).toThrow("Item Send is missing its item data");
  });

  it("throws when mapping to the SDK without metadata", () => {
    const sendItem = new SendItem({ ...data, metadata: undefined });

    expect(() => sendItem.toSdk()).toThrow("Item Send is missing its item metadata");
  });
});
