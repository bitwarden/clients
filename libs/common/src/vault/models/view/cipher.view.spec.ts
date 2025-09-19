import { Jsonify } from "type-fest";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { CipherPermissionsApi } from "@bitwarden/common/vault/models/api/cipher-permissions.api";
import {
  CipherView as SdkCipherView,
  CipherType as SdkCipherType,
  CipherRepromptType as SdkCipherRepromptType,
  AttachmentView as SdkAttachmentView,
  LoginUriView as SdkLoginUriView,
  LoginView as SdkLoginView,
  FieldView as SdkFieldView,
  FieldType as SdkFieldType,
} from "@bitwarden/sdk-internal";

import { mockFromJson, mockFromSdk } from "../../../../spec";
import { asUuid } from "../../../platform/abstractions/sdk/sdk.service";
import { CipherRepromptType } from "../../enums";
import { CipherType } from "../../enums/cipher-type";

import { AttachmentView } from "./attachment.view";
import { CardView } from "./card.view";
import { CipherView } from "./cipher.view";
import { FieldView } from "./field.view";
import { IdentityView } from "./identity.view";
import { LoginView } from "./login.view";
import { PasswordHistoryView } from "./password-history.view";
import { SecureNoteView } from "./secure-note.view";
import { SshKeyView } from "./ssh-key.view";

jest.mock("../../models/view/login.view");
jest.mock("../../models/view/attachment.view");
jest.mock("../../models/view/field.view");
jest.mock("../../models/view/password-history.view");

describe("CipherView", () => {
  beforeEach(() => {
    (LoginView as any).mockClear();
    (AttachmentView as any).mockClear();
    (FieldView as any).mockClear();
    (PasswordHistoryView as any).mockClear();
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(AttachmentView, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(FieldView, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(PasswordHistoryView, "fromJSON").mockImplementation(mockFromJson);

      const revisionDate = new Date("2022-08-04T01:06:40.441Z");
      const deletedDate = new Date("2022-09-04T01:06:40.441Z");
      const actual = CipherView.fromJSON({
        revisionDate: revisionDate.toISOString(),
        deletedDate: deletedDate.toISOString(),
        attachments: ["attachment1", "attachment2"] as any,
        fields: ["field1", "field2"] as any,
        passwordHistory: ["ph1", "ph2", "ph3"] as any,
      });

      const expected = {
        revisionDate: revisionDate,
        deletedDate: deletedDate,
        attachments: ["attachment1_fromJSON", "attachment2_fromJSON"],
        fields: ["field1_fromJSON", "field2_fromJSON"],
        passwordHistory: ["ph1_fromJSON", "ph2_fromJSON", "ph3_fromJSON"],
      };

      expect(actual).toMatchObject(expected);
    });

    test.each([
      // Test description, CipherType, expected output
      ["LoginView", CipherType.Login, { login: "myLogin_fromJSON" }],
      ["CardView", CipherType.Card, { card: "myCard_fromJSON" }],
      ["IdentityView", CipherType.Identity, { identity: "myIdentity_fromJSON" }],
      ["Secure Note", CipherType.SecureNote, { secureNote: "mySecureNote_fromJSON" }],
    ])("initializes %s", (description: string, cipherType: CipherType, expected: any) => {
      jest.spyOn(LoginView, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(IdentityView, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(CardView, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(SecureNoteView, "fromJSON").mockImplementation(mockFromJson);

      const actual = CipherView.fromJSON({
        login: "myLogin",
        card: "myCard",
        identity: "myIdentity",
        secureNote: "mySecureNote",
        type: cipherType,
      } as any);

      expect(actual).toMatchObject(expected);
    });

    it("handle both string and object inputs for the cipher key", () => {
      const cipherKeyString = "cipherKeyString";
      const cipherKeyObject = new EncString("cipherKeyObject");

      // Test with string input
      let actual = CipherView.fromJSON({
        key: cipherKeyString,
      });
      expect(actual.key).toBeInstanceOf(EncString);
      expect(actual.key?.toJSON()).toBe(cipherKeyString);

      // Test with object input (which can happen when cipher view is stored in an InMemory state provider)
      actual = CipherView.fromJSON({
        key: cipherKeyObject,
      } as Jsonify<CipherView>);
      expect(actual.key).toBeInstanceOf(EncString);
      expect(actual.key?.toJSON()).toBe(cipherKeyObject.toJSON());
    });
  });

  describe("fromSdkCipherView", () => {
    let sdkCipherView: SdkCipherView;

    beforeEach(() => {
      jest.spyOn(CardView, "fromSdkCardView").mockImplementation(mockFromSdk);
      jest.spyOn(IdentityView, "fromSdkIdentityView").mockImplementation(mockFromSdk);
      jest.spyOn(LoginView, "fromSdkLoginView").mockImplementation(mockFromSdk);
      jest.spyOn(SecureNoteView, "fromSdkSecureNoteView").mockImplementation(mockFromSdk);
      jest.spyOn(SshKeyView, "fromSdkSshKeyView").mockImplementation(mockFromSdk);
      jest.spyOn(AttachmentView, "fromSdkAttachmentView").mockImplementation(mockFromSdk);
      jest.spyOn(FieldView, "fromSdkFieldView").mockImplementation(mockFromSdk);

      sdkCipherView = {
        id: "id" as any,
        organizationId: "orgId" as any,
        folderId: "folderId" as any,
        collectionIds: ["collectionId" as any],
        key: undefined,
        name: "name",
        notes: undefined,
        type: SdkCipherType.Login,
        favorite: true,
        edit: true,
        reprompt: SdkCipherRepromptType.None,
        organizationUseTotp: false,
        viewPassword: true,
        localData: undefined,
        permissions: undefined,
        attachments: [{ id: "attachmentId", url: "attachmentUrl" } as SdkAttachmentView],
        login: {
          username: "username",
          password: "password",
          uris: [{ uri: "bitwarden.com" } as SdkLoginUriView],
          totp: "totp",
          autofillOnPageLoad: true,
        } as SdkLoginView,
        identity: undefined,
        card: undefined,
        secureNote: undefined,
        sshKey: undefined,
        fields: [
          {
            name: "fieldName",
            value: "fieldValue",
            type: SdkFieldType.Linked,
            linkedId: 100,
          } as SdkFieldView,
        ],
        passwordHistory: undefined,
        creationDate: "2022-01-01T12:00:00.000Z",
        revisionDate: "2022-01-02T12:00:00.000Z",
        deletedDate: undefined,
      };
    });

    it("returns undefined when input is null", () => {
      expect(CipherView.fromSdkCipherView(null as unknown as SdkCipherView)).toBeUndefined();
    });

    it("maps properties correctly", () => {
      const result = CipherView.fromSdkCipherView(sdkCipherView);

      expect(result).toMatchObject({
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        collectionIds: ["collectionId"],
        name: "name",
        notes: undefined,
        type: CipherType.Login,
        favorite: true,
        edit: true,
        reprompt: CipherRepromptType.None,
        organizationUseTotp: false,
        viewPassword: true,
        localData: undefined,
        permissions: undefined,
        attachments: [
          {
            id: "attachmentId",
            url: "attachmentUrl",
            __fromSdk: true,
          },
        ],
        login: {
          username: "username",
          password: "password",
          uris: [
            {
              uri: "bitwarden.com",
            },
          ],
          totp: "totp",
          autofillOnPageLoad: true,
          __fromSdk: true,
        },
        identity: new IdentityView(),
        card: new CardView(),
        secureNote: new SecureNoteView(),
        sshKey: new SshKeyView(),
        fields: [
          {
            name: "fieldName",
            value: "fieldValue",
            type: SdkFieldType.Linked,
            linkedId: 100,
            __fromSdk: true,
          },
        ],
        passwordHistory: [],
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        revisionDate: new Date("2022-01-02T12:00:00.000Z"),
        deletedDate: undefined,
      });
    });
  });

  describe("toSdkCipherView", () => {
    it("maps properties correctly", () => {
      const cipherView = new CipherView();
      cipherView.id = "0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602";
      cipherView.organizationId = "000f2a6e-da5e-4726-87ed-1c5c77322c3c";
      cipherView.folderId = "41b22db4-8e2a-4ed2-b568-f1186c72922f";
      cipherView.collectionIds = ["b0473506-3c3c-4260-a734-dfaaf833ab6f"];
      cipherView.key = new EncString("some-key");
      cipherView.name = "name";
      cipherView.notes = "notes";
      cipherView.type = CipherType.Login;
      cipherView.favorite = true;
      cipherView.edit = true;
      cipherView.viewPassword = false;
      cipherView.reprompt = CipherRepromptType.None;
      cipherView.organizationUseTotp = false;
      cipherView.localData = {
        lastLaunched: new Date("2022-01-01T12:00:00.000Z").getTime(),
        lastUsedDate: new Date("2022-01-02T12:00:00.000Z").getTime(),
      };
      cipherView.permissions = new CipherPermissionsApi();
      cipherView.permissions.restore = true;
      cipherView.permissions.delete = true;
      cipherView.attachments = [];
      cipherView.fields = [];
      cipherView.passwordHistory = [];
      cipherView.login = new LoginView();
      cipherView.revisionDate = new Date("2022-01-02T12:00:00.000Z");
      cipherView.creationDate = new Date("2022-01-02T12:00:00.000Z");

      const sdkCipherView = cipherView.toSdkCipherView();

      expect(sdkCipherView).toMatchObject({
        id: asUuid("0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602"),
        organizationId: asUuid("000f2a6e-da5e-4726-87ed-1c5c77322c3c"),
        folderId: asUuid("41b22db4-8e2a-4ed2-b568-f1186c72922f"),
        collectionIds: [asUuid("b0473506-3c3c-4260-a734-dfaaf833ab6f")],
        key: "some-key" as any,
        name: "name",
        notes: "notes",
        type: SdkCipherType.Login,
        favorite: true,
        edit: true,
        viewPassword: false,
        reprompt: SdkCipherRepromptType.None,
        organizationUseTotp: false,
        localData: {
          lastLaunched: "2022-01-01T12:00:00.000Z",
          lastUsedDate: "2022-01-02T12:00:00.000Z",
        },
        permissions: {
          restore: true,
          delete: true,
        },
        deletedDate: undefined,
        creationDate: "2022-01-02T12:00:00.000Z",
        revisionDate: "2022-01-02T12:00:00.000Z",
        attachments: [],
        passwordHistory: [],
        login: undefined,
        identity: undefined,
        card: undefined,
        secureNote: undefined,
        sshKey: undefined,
        fields: [],
      } as SdkCipherView);
    });
  });
});
