import {
  AuthType as SdkAuthType,
  SendType as SdkSendType,
  SendView as SdkSendView,
} from "@bitwarden/sdk-internal";

import { Utils } from "../../../../platform/misc/utils";
import { AuthType } from "../../types/auth-type";
import { SendType } from "../../types/send-type";

import { SendFileView } from "./send-file.view";
import { SendTextView } from "./send-text.view";
import { SendView } from "./send.view";

/**
 * Tests for the decrypted `SendView` -> SDK `SendView` mapping used by the key-rotation flow
 * (`SendClient.encrypt_send_for_rotation`). The `key` is a 16-byte send-key seed the SDK expects
 * URL-safe-base64-encoded.
 */
describe("SendView.toSdkSendView", () => {
  it("maps a text send view, url-b64-encoding the key seed", () => {
    const key = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const view = new SendView();
    view.id = "00000000-0000-0000-0000-000000000001";
    view.accessId = "access-id";
    view.type = SendType.Text;
    view.name = "plain name";
    view.notes = "plain notes";
    view.key = key;
    view.text = Object.assign(new SendTextView(), { text: "hello", hidden: false });
    view.maxAccessCount = 5;
    view.accessCount = 2;
    view.disabled = false;
    view.hideEmail = true;
    view.revisionDate = new Date("2026-01-01T00:00:00.000Z");
    view.deletionDate = new Date("2026-02-01T00:00:00.000Z");
    view.expirationDate = new Date("2026-01-15T00:00:00.000Z");
    view.emails = ["a@example.com"];
    view.authType = AuthType.None;
    view.password = null;

    const sdk = view.toSdkSendView();

    expect(sdk.id).toBe(view.id);
    expect(sdk.accessId).toBe("access-id");
    expect(sdk.name).toBe("plain name");
    expect(sdk.notes).toBe("plain notes");
    expect(sdk.key).toBe(Utils.fromArrayToUrlB64(key));
    // newPassword carries a *plaintext* password to re-derive the proof-of-knowledge, which a
    // decrypted view does not hold; rotation never changes the send-key seed the hash is salted
    // with, so it is intentionally left undefined.
    expect(sdk.newPassword).toBeUndefined();
    expect(sdk.hasPassword).toBe(false);
    expect(sdk.type).toBe(SdkSendType.Text);
    expect(sdk.text).toEqual({ text: "hello", hidden: false });
    expect(sdk.file).toBeUndefined();
    expect(sdk.maxAccessCount).toBe(5);
    expect(sdk.accessCount).toBe(2);
    expect(sdk.hideEmail).toBe(true);
    expect(sdk.revisionDate).toBe("2026-01-01T00:00:00.000Z");
    expect(sdk.deletionDate).toBe("2026-02-01T00:00:00.000Z");
    expect(sdk.expirationDate).toBe("2026-01-15T00:00:00.000Z");
    expect(sdk.emails).toEqual(["a@example.com"]);
    expect(sdk.authType).toBe(SdkAuthType.None);
  });

  it("maps a file send view and reports hasPassword from a decrypted password", () => {
    const view = new SendView();
    view.id = "00000000-0000-0000-0000-000000000002";
    view.type = SendType.File;
    view.name = "file name";
    view.key = new Uint8Array(16);
    view.file = Object.assign(new SendFileView(), {
      id: "file-id",
      fileName: "doc.txt",
      size: "1024",
      sizeName: "1 KB",
    });
    view.deletionDate = new Date("2026-02-01T00:00:00.000Z");
    view.emails = [];
    view.authType = AuthType.Password;
    view.password = "existing-hash";

    const sdk = view.toSdkSendView();

    expect(sdk.type).toBe(SdkSendType.File);
    expect(sdk.hasPassword).toBe(true);
    expect(sdk.newPassword).toBeUndefined();
    expect(sdk.text).toBeUndefined();
    expect(sdk.file).toEqual({
      id: "file-id",
      fileName: "doc.txt",
      size: "1024",
      sizeName: "1 KB",
    });
    expect(sdk.authType).toBe(SdkAuthType.Password);
  });

  it("omits the key when the view carries none", () => {
    const view = new SendView();
    view.type = SendType.Text;
    view.name = "no key";
    view.key = null;
    view.deletionDate = new Date("2026-02-01T00:00:00.000Z");
    view.emails = [];
    view.authType = AuthType.None;

    expect(view.toSdkSendView().key).toBeUndefined();
  });
});

describe("SendView.fromSdkSend", () => {
  it("sets password field in destination object to truthy placeholder since source doesn't contain it", () => {
    const sdkSendView = {
      hasPassword: true,
    } as SdkSendView;

    const sendView = SendView.fromSdkSendView(sdkSendView);
    expect(sendView.password).toEqual("************");
  });

  it("handles missing fields in the source object", () => {
    const sdkSendView = {
      name: "Test Send",
      type: SdkSendType.Text,
      text: {
        text: "Test Send contents",
        hidden: false,
      },
      authType: SdkAuthType.None,
      hasPassword: false,
      accessCount: 0,
      disabled: false,
      hideEmail: false,
      revisionDate: new Date(),
      deletionDate: new Date(),
      emails: [],
    } as any as SdkSendView;

    const sendView = SendView.fromSdkSendView(sdkSendView);
    expect(sendView).toEqual({
      id: null,
      name: "Test Send",
      accessCount: 0,
      accessId: null,
      authType: AuthType.None,
      deletionDate: sdkSendView.deletionDate,
      disabled: false,
      emails: [],
      expirationDate: null,
      file: null,
      text: {
        text: "Test Send contents",
        hidden: false,
      },
      hideEmail: false,
      key: null,
      password: null,
      revisionDate: sdkSendView.revisionDate,
      type: SendType.Text,
      maxAccessCount: undefined,
      notes: undefined,
    });
  });
});

describe("SendView to SdkSendView round trip", () => {
  it("gives you back the input value when called toSdkView() -> fromSdkView()", () => {
    const key = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const view = new SendView();
    view.id = "00000000-0000-0000-0000-000000000001";
    view.accessId = "access-id";
    view.type = SendType.Text;
    view.name = "plain name";
    view.notes = "plain notes";
    view.key = key;
    view.text = Object.assign(new SendTextView(), { text: "hello", hidden: false });
    view.file = null;
    view.maxAccessCount = 5;
    view.accessCount = 2;
    view.disabled = false;
    view.hideEmail = true;
    view.revisionDate = new Date("2026-01-01T00:00:00.000Z");
    view.deletionDate = new Date("2026-02-01T00:00:00.000Z");
    view.expirationDate = new Date("2026-01-15T00:00:00.000Z");
    view.emails = ["a@example.com"];
    view.authType = AuthType.None;
    view.password = null;

    const sdkSendView = view.toSdkSendView();
    const roundTripView = SendView.fromSdkSendView(sdkSendView);

    expect(view).toEqual(roundTripView);
  });

  it("gives you back the input value when called fromSdkView() -> toSdkView()", () => {
    const sdkSendView = {
      accessId: undefined,
      id: undefined,
      key: undefined,
      name: "Test Send",
      notes: "Test Notes",
      type: SdkSendType.Text,
      text: {
        text: "Test Send contents",
        hidden: false,
      },
      file: undefined,
      data: undefined,
      maxAccessCount: undefined,
      expirationDate: undefined,
      newPassword: undefined,
      authType: SdkAuthType.None,
      hasPassword: false,
      accessCount: 0,
      disabled: false,
      hideEmail: false,
      revisionDate: new Date().toISOString(),
      deletionDate: new Date().toISOString(),
      emails: [],
    } as SdkSendView;

    const view = SendView.fromSdkSendView(sdkSendView);
    const roundTripSdkSendView = view.toSdkSendView();

    expect(sdkSendView).toEqual(roundTripSdkSendView);
  });
});
