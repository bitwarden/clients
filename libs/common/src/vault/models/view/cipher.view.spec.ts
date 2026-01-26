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

    it("fromJSON should always restore top-level CipherView properties", () => {
      jest.spyOn(LoginView, "fromJSON").mockImplementation(mockFromJson);
      // Create a fully populated CipherView instance
      const original = new CipherView();
      original.id = "test-id";
      original.organizationId = "org-id";
      original.folderId = "folder-id";
      original.name = "test-name";
      original.notes = "test-notes";
      original.type = CipherType.Login;
      original.favorite = true;
      original.organizationUseTotp = true;
      original.permissions = new CipherPermissionsApi();
      original.edit = true;
      original.viewPassword = false;
      original.localData = { lastUsedDate: Date.now() };
      original.login = new LoginView();
      original.identity = new IdentityView();
      original.card = new CardView();
      original.secureNote = new SecureNoteView();
      original.sshKey = new SshKeyView();
      original.attachments = [];
      original.fields = [];
      original.passwordHistory = [];
      original.collectionIds = ["collection-1"];
      original.revisionDate = new Date("2022-01-01");
      original.creationDate = new Date("2022-01-02");
      original.deletedDate = new Date("2022-01-03");
      original.archivedDate = new Date("2022-01-04");
      original.reprompt = CipherRepromptType.Password;
      original.key = new EncString("test-key");
      original.decryptionFailure = true;

      // Serialize and deserialize
      const json = original.toJSON();
      const restored = CipherView.fromJSON(json as any);

      // Get all enumerable properties from the original instance
      const originalProps = Object.keys(original);

      // Check that all properties exist on the restored instance
      for (const prop of originalProps) {
        try {
          expect(restored).toHaveProperty(prop);
        } catch {
          throw new Error(`Property '${prop}' is missing from restored instance`);
        }

        // For non-function, non-getter properties, verify the value is defined
        const descriptor = Object.getOwnPropertyDescriptor(CipherView.prototype, prop);
        if (!descriptor?.get && typeof (original as any)[prop] !== "function") {
          try {
            expect((restored as any)[prop]).toBeDefined();
          } catch {
            throw new Error(`Property '${prop}' is undefined in restored instance`);
          }
        }
      }

      // Verify restored instance has the same properties as original
      const restoredProps = Object.keys(restored!).sort();
      const sortedOriginalProps = originalProps.sort();

      expect(restoredProps).toEqual(sortedOriginalProps);
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
        archivedDate: undefined,
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
        type: CipherType.Login,
        favorite: true,
        edit: true,
        reprompt: CipherRepromptType.None,
        organizationUseTotp: false,
        viewPassword: true,
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
        creationDate: "2022-01-02T12:00:00.000Z",
        revisionDate: "2022-01-02T12:00:00.000Z",
        attachments: [],
        passwordHistory: [],
        fields: [],
      });
    });
  });

  // Note: These tests use jest.requireActual() because the file has jest.mock() calls
  // at the top that mock LoginView, FieldView, etc. Those mocks are needed for other tests
  // but interfere with these tests which need the real implementations.
  describe("toSdkCreateCipherRequest", () => {
    it("maps all properties correctly for a login cipher", () => {
      const { FieldView: RealFieldView } = jest.requireActual("./field.view");
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");

      const cipherView = new CipherView();
      cipherView.organizationId = "000f2a6e-da5e-4726-87ed-1c5c77322c3c";
      cipherView.folderId = "41b22db4-8e2a-4ed2-b568-f1186c72922f";
      cipherView.collectionIds = ["b0473506-3c3c-4260-a734-dfaaf833ab6f"];
      cipherView.name = "Test Login";
      cipherView.notes = "Test notes";
      cipherView.type = CipherType.Login;
      cipherView.favorite = true;
      cipherView.reprompt = CipherRepromptType.Password;

      const field = new RealFieldView();
      field.name = "testField";
      field.value = "testValue";
      field.type = SdkFieldType.Text;
      cipherView.fields = [field];

      cipherView.login = new RealLoginView();
      cipherView.login.username = "testuser";
      cipherView.login.password = "testpass";

      const result = cipherView.toSdkCreateCipherRequest();

      expect(result.organizationId).toEqual(asUuid("000f2a6e-da5e-4726-87ed-1c5c77322c3c"));
      expect(result.folderId).toEqual(asUuid("41b22db4-8e2a-4ed2-b568-f1186c72922f"));
      expect(result.collectionIds).toEqual([asUuid("b0473506-3c3c-4260-a734-dfaaf833ab6f")]);
      expect(result.name).toBe("Test Login");
      expect(result.notes).toBe("Test notes");
      expect(result.favorite).toBe(true);
      expect(result.reprompt).toBe(CipherRepromptType.Password);
      expect(result.fields).toHaveLength(1);
      expect(result.fields![0]).toMatchObject({
        name: "testField",
        value: "testValue",
        type: SdkFieldType.Text,
      });
      expect(result.type).toHaveProperty("login");
      expect((result.type as any).login).toMatchObject({
        username: "testuser",
        password: "testpass",
      });
    });

    it("handles undefined organizationId and folderId", () => {
      const { SecureNoteView: RealSecureNoteView } = jest.requireActual("./secure-note.view");

      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";
      cipherView.type = CipherType.SecureNote;
      cipherView.secureNote = new RealSecureNoteView();

      const result = cipherView.toSdkCreateCipherRequest();

      expect(result.organizationId).toBeUndefined();
      expect(result.folderId).toBeUndefined();
      expect(result.name).toBe("Test Cipher");
    });

    it("handles empty collectionIds array", () => {
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");

      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";
      cipherView.collectionIds = [];
      cipherView.type = CipherType.Login;
      cipherView.login = new RealLoginView();

      const result = cipherView.toSdkCreateCipherRequest();

      expect(result.collectionIds).toEqual([]);
    });

    it("defaults favorite to false when undefined", () => {
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");

      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";
      cipherView.favorite = undefined as any;
      cipherView.type = CipherType.Login;
      cipherView.login = new RealLoginView();

      const result = cipherView.toSdkCreateCipherRequest();

      expect(result.favorite).toBe(false);
    });

    it("defaults reprompt to None when undefined", () => {
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");

      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";
      cipherView.reprompt = undefined as any;
      cipherView.type = CipherType.Login;
      cipherView.login = new RealLoginView();

      const result = cipherView.toSdkCreateCipherRequest();

      expect(result.reprompt).toBe(CipherRepromptType.None);
    });

    test.each([
      ["Login", CipherType.Login, "login.view", "LoginView"],
      ["Card", CipherType.Card, "card.view", "CardView"],
      ["Identity", CipherType.Identity, "identity.view", "IdentityView"],
      ["SecureNote", CipherType.SecureNote, "secure-note.view", "SecureNoteView"],
      ["SshKey", CipherType.SshKey, "ssh-key.view", "SshKeyView"],
    ])(
      "creates correct type property for %s cipher",
      (typeName: string, cipherType: CipherType, moduleName: string, className: string) => {
        const module = jest.requireActual(`./${moduleName}`);
        const ViewClass = module[className];

        const cipherView = new CipherView();
        cipherView.name = `Test ${typeName}`;
        cipherView.type = cipherType;

        // Set the appropriate view property
        const viewPropertyName = typeName.charAt(0).toLowerCase() + typeName.slice(1);
        (cipherView as any)[viewPropertyName] = new ViewClass();

        const result = cipherView.toSdkCreateCipherRequest();

        const typeKey = typeName.charAt(0).toLowerCase() + typeName.slice(1);
        expect(result.type).toHaveProperty(typeKey);
      },
    );
  });

  describe("toSdkUpdateCipherRequest", () => {
    it("maps all properties correctly for an update request", () => {
      const { FieldView: RealFieldView } = jest.requireActual("./field.view");
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");

      const cipherView = new CipherView();
      cipherView.id = "0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602";
      cipherView.organizationId = "000f2a6e-da5e-4726-87ed-1c5c77322c3c";
      cipherView.folderId = "41b22db4-8e2a-4ed2-b568-f1186c72922f";
      cipherView.name = "Updated Login";
      cipherView.notes = "Updated notes";
      cipherView.type = CipherType.Login;
      cipherView.favorite = true;
      cipherView.reprompt = CipherRepromptType.Password;
      cipherView.revisionDate = new Date("2022-01-02T12:00:00.000Z");
      cipherView.archivedDate = new Date("2022-01-03T12:00:00.000Z");
      cipherView.key = new EncString("cipher-key");

      const mockField = new RealFieldView();
      mockField.name = "testField";
      mockField.value = "testValue";
      cipherView.fields = [mockField];

      cipherView.login = new RealLoginView();
      cipherView.login.username = "testuser";

      const result = cipherView.toSdkUpdateCipherRequest();

      expect(result.id).toEqual(asUuid("0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602"));
      expect(result.organizationId).toEqual(asUuid("000f2a6e-da5e-4726-87ed-1c5c77322c3c"));
      expect(result.folderId).toEqual(asUuid("41b22db4-8e2a-4ed2-b568-f1186c72922f"));
      expect(result.name).toBe("Updated Login");
      expect(result.notes).toBe("Updated notes");
      expect(result.favorite).toBe(true);
      expect(result.reprompt).toBe(CipherRepromptType.Password);
      expect(result.revisionDate).toBe("2022-01-02T12:00:00.000Z");
      expect(result.archivedDate).toBe("2022-01-03T12:00:00.000Z");
      expect(result.fields).toHaveLength(1);
      expect(result.fields![0]).toMatchObject({
        name: "testField",
        value: "testValue",
      });
      expect(result.type).toHaveProperty("login");
      expect((result.type as any).login).toMatchObject({
        username: "testuser",
      });
      expect(result.key).toBeDefined();
    });

    it("handles undefined optional properties", () => {
      const { SecureNoteView: RealSecureNoteView } = jest.requireActual("./secure-note.view");

      const cipherView = new CipherView();
      cipherView.id = "0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602";
      cipherView.name = "Test Cipher";
      cipherView.type = CipherType.SecureNote;
      cipherView.secureNote = new RealSecureNoteView();
      cipherView.revisionDate = new Date("2022-01-02T12:00:00.000Z");

      const result = cipherView.toSdkUpdateCipherRequest();

      expect(result.organizationId).toBeUndefined();
      expect(result.folderId).toBeUndefined();
      expect(result.archivedDate).toBeUndefined();
      expect(result.key).toBeUndefined();
    });

    it("converts dates to ISO strings", () => {
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");

      const cipherView = new CipherView();
      cipherView.id = "0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602";
      cipherView.name = "Test Cipher";
      cipherView.type = CipherType.Login;
      cipherView.login = new RealLoginView();
      cipherView.revisionDate = new Date("2022-05-15T10:30:00.000Z");
      cipherView.archivedDate = new Date("2022-06-20T14:45:00.000Z");

      const result = cipherView.toSdkUpdateCipherRequest();

      expect(result.revisionDate).toBe("2022-05-15T10:30:00.000Z");
      expect(result.archivedDate).toBe("2022-06-20T14:45:00.000Z");
    });

    it("includes attachments when present", () => {
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");
      const { AttachmentView: RealAttachmentView } = jest.requireActual("./attachment.view");

      const cipherView = new CipherView();
      cipherView.id = "0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602";
      cipherView.name = "Test Cipher";
      cipherView.type = CipherType.Login;
      cipherView.login = new RealLoginView();

      const attachment1 = new RealAttachmentView();
      attachment1.id = "attachment-id-1";
      attachment1.fileName = "file1.txt";

      const attachment2 = new RealAttachmentView();
      attachment2.id = "attachment-id-2";
      attachment2.fileName = "file2.pdf";

      cipherView.attachments = [attachment1, attachment2];

      const result = cipherView.toSdkUpdateCipherRequest();

      expect(result.attachments).toHaveLength(2);
    });

    test.each([
      ["Login", CipherType.Login, "login.view", "LoginView"],
      ["Card", CipherType.Card, "card.view", "CardView"],
      ["Identity", CipherType.Identity, "identity.view", "IdentityView"],
      ["SecureNote", CipherType.SecureNote, "secure-note.view", "SecureNoteView"],
      ["SshKey", CipherType.SshKey, "ssh-key.view", "SshKeyView"],
    ])(
      "creates correct type property for %s cipher",
      (typeName: string, cipherType: CipherType, moduleName: string, className: string) => {
        const module = jest.requireActual(`./${moduleName}`);
        const ViewClass = module[className];

        const cipherView = new CipherView();
        cipherView.id = "0a54d80c-14aa-4ef8-8c3a-7ea99ce5b602";
        cipherView.name = `Test ${typeName}`;
        cipherView.type = cipherType;

        // Set the appropriate view property
        const viewPropertyName = typeName.charAt(0).toLowerCase() + typeName.slice(1);
        (cipherView as any)[viewPropertyName] = new ViewClass();

        const result = cipherView.toSdkUpdateCipherRequest();

        const typeKey = typeName.charAt(0).toLowerCase() + typeName.slice(1);
        expect(result.type).toHaveProperty(typeKey);
      },
    );
  });

  describe("getSdkCipherViewType", () => {
    it("returns login type for Login cipher", () => {
      const { LoginView: RealLoginView } = jest.requireActual("./login.view");

      const cipherView = new CipherView();
      cipherView.type = CipherType.Login;
      cipherView.login = new RealLoginView();
      cipherView.login.username = "testuser";
      cipherView.login.password = "testpass";

      const result = cipherView.getSdkCipherViewType();

      expect(result).toHaveProperty("login");
      expect((result as any).login).toMatchObject({
        username: "testuser",
        password: "testpass",
      });
    });

    it("returns card type for Card cipher", () => {
      const { CardView: RealCardView } = jest.requireActual("./card.view");

      const cipherView = new CipherView();
      cipherView.type = CipherType.Card;
      cipherView.card = new RealCardView();
      cipherView.card.cardholderName = "John Doe";
      cipherView.card.number = "4111111111111111";

      const result = cipherView.getSdkCipherViewType();

      expect(result).toHaveProperty("card");
      expect((result as any).card.cardholderName).toBe("John Doe");
      expect((result as any).card.number).toBe("4111111111111111");
    });

    it("returns identity type for Identity cipher", () => {
      const { IdentityView: RealIdentityView } = jest.requireActual("./identity.view");

      const cipherView = new CipherView();
      cipherView.type = CipherType.Identity;
      cipherView.identity = new RealIdentityView();
      cipherView.identity.firstName = "John";
      cipherView.identity.lastName = "Doe";

      const result = cipherView.getSdkCipherViewType();

      expect(result).toHaveProperty("identity");
      expect((result as any).identity.firstName).toBe("John");
      expect((result as any).identity.lastName).toBe("Doe");
    });

    it("returns secureNote type for SecureNote cipher", () => {
      const { SecureNoteView: RealSecureNoteView } = jest.requireActual("./secure-note.view");

      const cipherView = new CipherView();
      cipherView.type = CipherType.SecureNote;
      cipherView.secureNote = new RealSecureNoteView();

      const result = cipherView.getSdkCipherViewType();

      expect(result).toHaveProperty("secureNote");
    });

    it("returns sshKey type for SshKey cipher", () => {
      const { SshKeyView: RealSshKeyView } = jest.requireActual("./ssh-key.view");

      const cipherView = new CipherView();
      cipherView.type = CipherType.SshKey;
      cipherView.sshKey = new RealSshKeyView();
      cipherView.sshKey.privateKey = "privateKeyData";
      cipherView.sshKey.publicKey = "publicKeyData";

      const result = cipherView.getSdkCipherViewType();

      expect(result).toHaveProperty("sshKey");
      expect((result as any).sshKey.privateKey).toBe("privateKeyData");
      expect((result as any).sshKey.publicKey).toBe("publicKeyData");
    });

    it("defaults to empty login for unknown cipher type", () => {
      const cipherView = new CipherView();
      cipherView.type = 999 as CipherType;

      const result = cipherView.getSdkCipherViewType();

      expect(result).toHaveProperty("login");
    });
  });
});
