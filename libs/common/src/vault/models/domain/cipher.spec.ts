import { mock } from "jest-mock-extended";
import { Jsonify } from "type-fest";

import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import {
  CipherType as SdkCipherType,
  UriMatchType,
  CipherRepromptType as SdkCipherRepromptType,
  LoginLinkedIdType,
  Cipher as SdkCipher,
  EncString as SdkEncString,
} from "@bitwarden/sdk-internal";

import { makeStaticByteArray, mockEnc, mockFromJson } from "../../../../spec/utils";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { UriMatchStrategy } from "../../../models/domain/domain-service";
import { ContainerService } from "../../../platform/services/container.service";
import { InitializerKey } from "../../../platform/services/cryptography/initializer-key";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../abstractions/cipher.service";
import { FieldType, LoginLinkedId, SecureNoteType } from "../../enums";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherType } from "../../enums/cipher-type";
import { CipherData } from "../../models/data/cipher.data";
import { Attachment } from "../../models/domain/attachment";
import { Card } from "../../models/domain/card";
import { Cipher } from "../../models/domain/cipher";
import { Field } from "../../models/domain/field";
import { Identity } from "../../models/domain/identity";
import { Login } from "../../models/domain/login";
import { Password } from "../../models/domain/password";
import { SecureNote } from "../../models/domain/secure-note";
import { CardView } from "../../models/view/card.view";
import { IdentityView } from "../../models/view/identity.view";
import { LoginView } from "../../models/view/login.view";
import { CipherPermissionsApi } from "../api/cipher-permissions.api";

describe("Cipher DTO", () => {
  it("Convert from empty CipherData", () => {
    const data = new CipherData();
    const cipher = new Cipher(data);

    expect(cipher.id).toBeUndefined();
    expect(cipher.organizationId).toBeUndefined();
    expect(cipher.folderId).toBeUndefined();
    expect(cipher.name).toBeInstanceOf(EncString);
    expect(cipher.notes).toBeUndefined();
    expect(cipher.type).toBeUndefined();
    expect(cipher.favorite).toBeUndefined();
    expect(cipher.organizationUseTotp).toBeUndefined();
    expect(cipher.edit).toBeUndefined();
    expect(cipher.viewPassword).toBeUndefined();
    expect(cipher.revisionDate).toBeInstanceOf(Date);
    expect(cipher.collectionIds).toEqual([]);
    expect(cipher.localData).toBeUndefined();
    expect(cipher.creationDate).toBeInstanceOf(Date);
    expect(cipher.deletedDate).toBeUndefined();
    expect(cipher.reprompt).toBeUndefined();
    expect(cipher.attachments).toBeUndefined();
    expect(cipher.fields).toBeUndefined();
    expect(cipher.passwordHistory).toBeUndefined();
    expect(cipher.key).toBeUndefined();
    expect(cipher.permissions).toBeUndefined();
    expect(cipher.archivedDate).toBeUndefined();
  });

  it("Decrypt should handle cipher key error", async () => {
    const cipher = new Cipher();
    cipher.id = "id";
    cipher.organizationId = "orgId";
    cipher.folderId = "folderId";
    cipher.edit = true;
    cipher.viewPassword = true;
    cipher.organizationUseTotp = true;
    cipher.favorite = false;
    cipher.revisionDate = new Date("2022-01-31T12:00:00.000Z");
    cipher.type = CipherType.Login;
    cipher.name = mockEnc("EncryptedString");
    cipher.notes = mockEnc("EncryptedString");
    cipher.creationDate = new Date("2022-01-01T12:00:00.000Z");
    cipher.deletedDate = undefined;
    cipher.reprompt = CipherRepromptType.None;
    cipher.key = mockEnc("EncKey");
    cipher.permissions = new CipherPermissionsApi();

    const loginView = new LoginView();
    loginView.username = "username";
    loginView.password = "password";

    const login = mock<Login>();
    login.decrypt.mockResolvedValue(loginView);
    cipher.login = login;

    const keyService = mock<KeyService>();
    const encryptService = mock<EncryptService>();
    const cipherService = mock<CipherService>();

    encryptService.unwrapSymmetricKey.mockRejectedValue(new Error("Failed to unwrap key"));

    (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

    const cipherView = await cipher.decrypt(
      await cipherService.getKeyForCipherKeyDecryption(cipher, mockUserId),
    );

    expect(cipherView).toMatchObject({
      id: "id",
      organizationId: "orgId",
      folderId: "folderId",
      name: "[error: cannot decrypt]",
      type: 1,
      favorite: false,
      organizationUseTotp: true,
      edit: true,
      viewPassword: true,
      decryptionFailure: true,
      collectionIds: [],
      revisionDate: new Date("2022-01-31T12:00:00.000Z"),
      creationDate: new Date("2022-01-01T12:00:00.000Z"),
      deletedDate: undefined,
      reprompt: 0,
      localData: undefined,
      permissions: new CipherPermissionsApi(),
    });

    expect(login.decrypt).not.toHaveBeenCalled();
  });

  describe("LoginCipher", () => {
    let cipherData: CipherData;

    beforeEach(() => {
      cipherData = {
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        edit: true,
        viewPassword: true,
        organizationUseTotp: true,
        favorite: false,
        revisionDate: "2022-01-31T12:00:00.000Z",
        type: CipherType.Login,
        name: "EncryptedString",
        notes: "EncryptedString",
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        permissions: new CipherPermissionsApi(),
        reprompt: CipherRepromptType.None,
        key: "EncryptedString",
        archivedDate: undefined,
        collectionIds: [],
        login: {
          uris: [
            {
              uri: "EncryptedString",
              uriChecksum: "EncryptedString",
              match: UriMatchStrategy.Domain,
            },
          ],
          username: "EncryptedString",
          password: "EncryptedString",
          passwordRevisionDate: "2022-01-31T12:00:00.000Z",
          totp: "EncryptedString",
          autofillOnPageLoad: false,
        },
        passwordHistory: [
          { password: "EncryptedString", lastUsedDate: "2022-01-31T12:00:00.000Z" },
        ],
        attachments: [
          {
            id: "a1",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
          {
            id: "a2",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
        ],
        fields: [
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Text,
            linkedId: null,
          },
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Hidden,
            linkedId: null,
          },
        ],
      };
    });

    it("Convert", () => {
      const cipher = new Cipher(cipherData);

      expect(cipher).toMatchObject({
        initializerKey: InitializerKey.Cipher,
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: { encryptedString: "EncryptedString", encryptionType: 0 },
        notes: { encryptedString: "EncryptedString", encryptionType: 0 },
        type: 1,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        collectionIds: [],
        localData: undefined,
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        permissions: new CipherPermissionsApi(),
        reprompt: 0,
        key: { encryptedString: "EncryptedString", encryptionType: 0 },
        archivedDate: undefined,
        login: {
          passwordRevisionDate: new Date("2022-01-31T12:00:00.000Z"),
          autofillOnPageLoad: false,
          username: { encryptedString: "EncryptedString", encryptionType: 0 },
          password: { encryptedString: "EncryptedString", encryptionType: 0 },
          totp: { encryptedString: "EncryptedString", encryptionType: 0 },
          uris: [
            {
              match: 0,
              uri: { encryptedString: "EncryptedString", encryptionType: 0 },
              uriChecksum: { encryptedString: "EncryptedString", encryptionType: 0 },
            },
          ],
        },
        attachments: [
          {
            fileName: { encryptedString: "file", encryptionType: 0 },
            id: "a1",
            key: { encryptedString: "EncKey", encryptionType: 0 },
            size: "1100",
            sizeName: "1.1 KB",
            url: "url",
          },
          {
            fileName: { encryptedString: "file", encryptionType: 0 },
            id: "a2",
            key: { encryptedString: "EncKey", encryptionType: 0 },
            size: "1100",
            sizeName: "1.1 KB",
            url: "url",
          },
        ],
        fields: [
          {
            linkedId: undefined,
            name: { encryptedString: "EncryptedString", encryptionType: 0 },
            type: 0,
            value: { encryptedString: "EncryptedString", encryptionType: 0 },
          },
          {
            linkedId: undefined,
            name: { encryptedString: "EncryptedString", encryptionType: 0 },
            type: 1,
            value: { encryptedString: "EncryptedString", encryptionType: 0 },
          },
        ],
        passwordHistory: [
          {
            lastUsedDate: new Date("2022-01-31T12:00:00.000Z"),
            password: { encryptedString: "EncryptedString", encryptionType: 0 },
          },
        ],
      });
    });

    it("toCipherData", () => {
      const cipher = new Cipher(cipherData);
      expect(cipher.toCipherData()).toEqual(cipherData);
    });

    it("Decrypt", async () => {
      const cipher = new Cipher();
      cipher.id = "id";
      cipher.organizationId = "orgId";
      cipher.folderId = "folderId";
      cipher.edit = true;
      cipher.viewPassword = true;
      cipher.organizationUseTotp = true;
      cipher.favorite = false;
      cipher.revisionDate = new Date("2022-01-31T12:00:00.000Z");
      cipher.type = CipherType.Login;
      cipher.name = mockEnc("EncryptedString");
      cipher.notes = mockEnc("EncryptedString");
      cipher.creationDate = new Date("2022-01-01T12:00:00.000Z");
      cipher.deletedDate = undefined;
      cipher.reprompt = CipherRepromptType.None;
      cipher.key = mockEnc("EncKey");
      cipher.permissions = new CipherPermissionsApi();
      cipher.archivedDate = undefined;

      const loginView = new LoginView();
      loginView.username = "username";
      loginView.password = "password";

      const login = mock<Login>();
      login.decrypt.mockResolvedValue(loginView);
      cipher.login = login;

      const keyService = mock<KeyService>();
      const encryptService = mock<EncryptService>();
      const cipherService = mock<CipherService>();

      encryptService.unwrapSymmetricKey.mockResolvedValue(
        new SymmetricCryptoKey(makeStaticByteArray(64)),
      );

      (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

      const cipherView = await cipher.decrypt(
        await cipherService.getKeyForCipherKeyDecryption(cipher, mockUserId),
      );

      expect(cipherView).toMatchObject({
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: "EncryptedString",
        notes: "EncryptedString",
        type: 1,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        login: loginView,
        attachments: [],
        fields: [],
        passwordHistory: [],
        collectionIds: [],
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        reprompt: 0,
        localData: undefined,
        permissions: new CipherPermissionsApi(),
        archivedDate: undefined,
      });
    });
  });

  describe("SecureNoteCipher", () => {
    let cipherData: CipherData;

    beforeEach(() => {
      cipherData = {
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        edit: true,
        viewPassword: true,
        organizationUseTotp: true,
        favorite: false,
        revisionDate: "2022-01-31T12:00:00.000Z",
        type: CipherType.SecureNote,
        name: "EncryptedString",
        notes: "EncryptedString",
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        reprompt: CipherRepromptType.None,
        key: "EncKey",
        collectionIds: [],
        secureNote: {
          type: SecureNoteType.Generic,
        },
        permissions: new CipherPermissionsApi(),
        archivedDate: undefined,
      };
    });

    it("Convert", () => {
      const cipher = new Cipher(cipherData);

      expect(cipher).toEqual({
        initializerKey: InitializerKey.Cipher,
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: { encryptedString: "EncryptedString", encryptionType: 0 },
        notes: { encryptedString: "EncryptedString", encryptionType: 0 },
        type: 2,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        collectionIds: [],
        localData: undefined,
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        reprompt: 0,
        secureNote: { type: SecureNoteType.Generic },
        attachments: undefined,
        fields: undefined,
        passwordHistory: undefined,
        key: { encryptedString: "EncKey", encryptionType: 0 },
        permissions: new CipherPermissionsApi(),
        archivedDate: undefined,
      });
    });

    it("toCipherData", () => {
      const cipher = new Cipher(cipherData);
      expect(cipher.toCipherData()).toEqual(cipherData);
    });

    it("Decrypt", async () => {
      const cipher = new Cipher();
      cipher.id = "id";
      cipher.organizationId = "orgId";
      cipher.folderId = "folderId";
      cipher.edit = true;
      cipher.viewPassword = true;
      cipher.organizationUseTotp = true;
      cipher.favorite = false;
      cipher.revisionDate = new Date("2022-01-31T12:00:00.000Z");
      cipher.type = CipherType.SecureNote;
      cipher.name = mockEnc("EncryptedString");
      cipher.notes = mockEnc("EncryptedString");
      cipher.creationDate = new Date("2022-01-01T12:00:00.000Z");
      cipher.deletedDate = undefined;
      cipher.reprompt = CipherRepromptType.None;
      cipher.secureNote = new SecureNote();
      cipher.secureNote.type = SecureNoteType.Generic;
      cipher.key = mockEnc("EncKey");
      cipher.permissions = new CipherPermissionsApi();
      cipher.archivedDate = undefined;

      const keyService = mock<KeyService>();
      const encryptService = mock<EncryptService>();
      const cipherService = mock<CipherService>();

      encryptService.unwrapSymmetricKey.mockResolvedValue(
        new SymmetricCryptoKey(makeStaticByteArray(64)),
      );

      (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

      const cipherView = await cipher.decrypt(
        await cipherService.getKeyForCipherKeyDecryption(cipher, mockUserId),
      );

      expect(cipherView).toMatchObject({
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: "EncryptedString",
        notes: "EncryptedString",
        type: 2,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        secureNote: { type: 0 },
        attachments: [],
        fields: [],
        passwordHistory: [],
        collectionIds: [],
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        reprompt: 0,
        localData: undefined,
        permissions: new CipherPermissionsApi(),
        archivedDate: undefined,
      });
    });
  });

  describe("CardCipher", () => {
    let cipherData: CipherData;

    beforeEach(() => {
      cipherData = {
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        edit: true,
        viewPassword: true,
        organizationUseTotp: true,
        favorite: false,
        revisionDate: "2022-01-31T12:00:00.000Z",
        type: CipherType.Card,
        name: "EncryptedString",
        notes: "EncryptedString",
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        permissions: new CipherPermissionsApi(),
        reprompt: CipherRepromptType.None,
        collectionIds: [],
        card: {
          cardholderName: "EncryptedString",
          brand: "EncryptedString",
          number: "EncryptedString",
          expMonth: "EncryptedString",
          expYear: "EncryptedString",
          code: "EncryptedString",
        },
        key: "EncKey",
        archivedDate: undefined,
      };
    });

    it("Convert", () => {
      const cipher = new Cipher(cipherData);

      expect(cipher).toEqual({
        initializerKey: InitializerKey.Cipher,
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: { encryptedString: "EncryptedString", encryptionType: 0 },
        notes: { encryptedString: "EncryptedString", encryptionType: 0 },
        type: 3,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        collectionIds: [],
        localData: undefined,
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        reprompt: 0,
        card: {
          cardholderName: { encryptedString: "EncryptedString", encryptionType: 0 },
          brand: { encryptedString: "EncryptedString", encryptionType: 0 },
          number: { encryptedString: "EncryptedString", encryptionType: 0 },
          expMonth: { encryptedString: "EncryptedString", encryptionType: 0 },
          expYear: { encryptedString: "EncryptedString", encryptionType: 0 },
          code: { encryptedString: "EncryptedString", encryptionType: 0 },
        },
        attachments: undefined,
        fields: undefined,
        passwordHistory: undefined,
        key: { encryptedString: "EncKey", encryptionType: 0 },
        permissions: new CipherPermissionsApi(),
        archivedDate: undefined,
      });
    });

    it("toCipherData", () => {
      const cipher = new Cipher(cipherData);
      expect(cipher.toCipherData()).toEqual(cipherData);
    });

    it("Decrypt", async () => {
      const cipher = new Cipher();
      cipher.id = "id";
      cipher.organizationId = "orgId";
      cipher.folderId = "folderId";
      cipher.edit = true;
      cipher.viewPassword = true;
      cipher.organizationUseTotp = true;
      cipher.favorite = false;
      cipher.revisionDate = new Date("2022-01-31T12:00:00.000Z");
      cipher.type = CipherType.Card;
      cipher.name = mockEnc("EncryptedString");
      cipher.notes = mockEnc("EncryptedString");
      cipher.creationDate = new Date("2022-01-01T12:00:00.000Z");
      cipher.deletedDate = undefined;
      cipher.reprompt = CipherRepromptType.None;
      cipher.key = mockEnc("EncKey");
      cipher.permissions = new CipherPermissionsApi();
      cipher.archivedDate = undefined;

      const cardView = new CardView();
      cardView.cardholderName = "cardholderName";
      cardView.number = "4111111111111111";

      const card = mock<Card>();
      card.decrypt.mockResolvedValue(cardView);
      cipher.card = card;

      const keyService = mock<KeyService>();
      const encryptService = mock<EncryptService>();
      const cipherService = mock<CipherService>();

      encryptService.unwrapSymmetricKey.mockResolvedValue(
        new SymmetricCryptoKey(makeStaticByteArray(64)),
      );

      (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

      const cipherView = await cipher.decrypt(
        await cipherService.getKeyForCipherKeyDecryption(cipher, mockUserId),
      );

      expect(cipherView).toMatchObject({
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: "EncryptedString",
        notes: "EncryptedString",
        type: 3,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        card: cardView,
        attachments: [],
        fields: [],
        passwordHistory: [],
        collectionIds: [],
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        reprompt: 0,
        localData: undefined,
        permissions: new CipherPermissionsApi(),
        archivedDate: undefined,
      });
    });
  });

  describe("IdentityCipher", () => {
    let cipherData: CipherData;

    beforeEach(() => {
      cipherData = {
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        edit: true,
        viewPassword: true,
        organizationUseTotp: true,
        favorite: false,
        revisionDate: "2022-01-31T12:00:00.000Z",
        type: CipherType.Identity,
        name: "EncryptedString",
        notes: "EncryptedString",
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        permissions: new CipherPermissionsApi(),
        reprompt: CipherRepromptType.None,
        key: "EncKey",
        archivedDate: undefined,
        collectionIds: [],
        identity: {
          title: "EncryptedString",
          firstName: "EncryptedString",
          middleName: "EncryptedString",
          lastName: "EncryptedString",
          address1: "EncryptedString",
          address2: "EncryptedString",
          address3: "EncryptedString",
          city: "EncryptedString",
          state: "EncryptedString",
          postalCode: "EncryptedString",
          country: "EncryptedString",
          company: "EncryptedString",
          email: "EncryptedString",
          phone: "EncryptedString",
          ssn: "EncryptedString",
          username: "EncryptedString",
          passportNumber: "EncryptedString",
          licenseNumber: "EncryptedString",
        },
      };
    });

    it("Convert", () => {
      const cipher = new Cipher(cipherData);

      expect(cipher).toEqual({
        initializerKey: InitializerKey.Cipher,
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: { encryptedString: "EncryptedString", encryptionType: 0 },
        notes: { encryptedString: "EncryptedString", encryptionType: 0 },
        type: 4,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        collectionIds: [],
        localData: undefined,
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        reprompt: 0,
        archivedDate: undefined,
        identity: {
          title: { encryptedString: "EncryptedString", encryptionType: 0 },
          firstName: { encryptedString: "EncryptedString", encryptionType: 0 },
          middleName: { encryptedString: "EncryptedString", encryptionType: 0 },
          lastName: { encryptedString: "EncryptedString", encryptionType: 0 },
          address1: { encryptedString: "EncryptedString", encryptionType: 0 },
          address2: { encryptedString: "EncryptedString", encryptionType: 0 },
          address3: { encryptedString: "EncryptedString", encryptionType: 0 },
          city: { encryptedString: "EncryptedString", encryptionType: 0 },
          state: { encryptedString: "EncryptedString", encryptionType: 0 },
          postalCode: { encryptedString: "EncryptedString", encryptionType: 0 },
          country: { encryptedString: "EncryptedString", encryptionType: 0 },
          company: { encryptedString: "EncryptedString", encryptionType: 0 },
          email: { encryptedString: "EncryptedString", encryptionType: 0 },
          phone: { encryptedString: "EncryptedString", encryptionType: 0 },
          ssn: { encryptedString: "EncryptedString", encryptionType: 0 },
          username: { encryptedString: "EncryptedString", encryptionType: 0 },
          passportNumber: { encryptedString: "EncryptedString", encryptionType: 0 },
          licenseNumber: { encryptedString: "EncryptedString", encryptionType: 0 },
        },
        attachments: undefined,
        fields: undefined,
        passwordHistory: undefined,
        key: { encryptedString: "EncKey", encryptionType: 0 },
        permissions: new CipherPermissionsApi(),
      });
    });

    it("toCipherData", () => {
      const cipher = new Cipher(cipherData);
      expect(cipher.toCipherData()).toEqual(cipherData);
    });

    it("Decrypt", async () => {
      const cipher = new Cipher();
      cipher.id = "id";
      cipher.organizationId = "orgId";
      cipher.folderId = "folderId";
      cipher.edit = true;
      cipher.viewPassword = true;
      cipher.organizationUseTotp = true;
      cipher.favorite = false;
      cipher.revisionDate = new Date("2022-01-31T12:00:00.000Z");
      cipher.type = CipherType.Identity;
      cipher.name = mockEnc("EncryptedString");
      cipher.notes = mockEnc("EncryptedString");
      cipher.creationDate = new Date("2022-01-01T12:00:00.000Z");
      cipher.deletedDate = undefined;
      cipher.reprompt = CipherRepromptType.None;
      cipher.key = mockEnc("EncKey");
      cipher.permissions = new CipherPermissionsApi();
      cipher.archivedDate = undefined;

      const identityView = new IdentityView();
      identityView.firstName = "firstName";
      identityView.lastName = "lastName";

      const identity = mock<Identity>();
      identity.decrypt.mockResolvedValue(identityView);
      cipher.identity = identity;

      const keyService = mock<KeyService>();
      const encryptService = mock<EncryptService>();
      const cipherService = mock<CipherService>();

      encryptService.unwrapSymmetricKey.mockResolvedValue(
        new SymmetricCryptoKey(makeStaticByteArray(64)),
      );

      (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

      const cipherView = await cipher.decrypt(
        await cipherService.getKeyForCipherKeyDecryption(cipher, mockUserId),
      );

      expect(cipherView).toMatchObject({
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        name: "EncryptedString",
        notes: "EncryptedString",
        type: 4,
        favorite: false,
        organizationUseTotp: true,
        edit: true,
        viewPassword: true,
        identity: identityView,
        attachments: [],
        fields: [],
        passwordHistory: [],
        collectionIds: [],
        revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        creationDate: new Date("2022-01-01T12:00:00.000Z"),
        deletedDate: undefined,
        reprompt: 0,
        localData: undefined,
        permissions: new CipherPermissionsApi(),
        archivedDate: undefined,
      });
    });
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(Attachment, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(Field, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(Password, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);

      const revisionDate = new Date("2022-08-04T01:06:40.441Z");
      const deletedDate = new Date("2022-09-04T01:06:40.441Z");
      const archivedDate = new Date("2022-10-04T01:06:40.441Z");
      const actual = Cipher.fromJSON({
        name: "myName",
        notes: "myNotes",
        revisionDate: revisionDate.toISOString(),
        attachments: ["attachment1", "attachment2"] as any,
        fields: ["field1", "field2"] as any,
        passwordHistory: ["ph1", "ph2"] as any,
        deletedDate: deletedDate.toISOString(),
        archivedDate: archivedDate.toISOString(),
      } as Jsonify<Cipher>);

      expect(actual).toMatchObject({
        name: "myName_fromJSON",
        notes: "myNotes_fromJSON",
        revisionDate: revisionDate,
        attachments: ["attachment1_fromJSON", "attachment2_fromJSON"],
        fields: ["field1_fromJSON", "field2_fromJSON"],
        passwordHistory: ["ph1_fromJSON", "ph2_fromJSON"],
        deletedDate: deletedDate,
        archivedDate: archivedDate,
      });
      expect(actual).toBeInstanceOf(Cipher);
    });

    test.each([
      // Test description, CipherType, expected output
      ["LoginView", CipherType.Login, { login: "myLogin_fromJSON" }],
      ["CardView", CipherType.Card, { card: "myCard_fromJSON" }],
      ["IdentityView", CipherType.Identity, { identity: "myIdentity_fromJSON" }],
      ["Secure Note", CipherType.SecureNote, { secureNote: "mySecureNote_fromJSON" }],
    ])("initializes %s", (description: string, cipherType: CipherType, expected: any) => {
      jest.spyOn(Login, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(Identity, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(Card, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(SecureNote, "fromJSON").mockImplementation(mockFromJson);

      const actual = Cipher.fromJSON({
        login: "myLogin",
        card: "myCard",
        identity: "myIdentity",
        secureNote: "mySecureNote",
        type: cipherType,
      } as any);

      expect(actual).toMatchObject(expected);
    });

    it("returns undefined if object is undefined", () => {
      expect(Cipher.fromJSON(undefined)).toBeUndefined();
    });
  });

  describe("toSdkCipher", () => {
    it("should map to SDK Cipher", () => {
      const lastUsedDate = new Date("2025-04-15T12:00:00.000Z").getTime();
      const lastLaunched = new Date("2025-04-15T12:00:00.000Z").getTime();

      const cipherData: CipherData = {
        id: "2afb03fd-0d8e-4c08-a316-18b2f0efa618",
        organizationId: "4748ad12-212e-4bc8-82b7-a75f6709d033",
        folderId: "b4dac811-e44a-495a-9334-9e53b7aaf54c",
        edit: true,
        permissions: new CipherPermissionsApi(),
        viewPassword: true,
        organizationUseTotp: true,
        favorite: false,
        revisionDate: "2022-01-31T12:00:00.000Z",
        type: CipherType.Login,
        name: "EncryptedString",
        notes: "EncryptedString",
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        archivedDate: undefined,
        reprompt: CipherRepromptType.None,
        key: "EncryptedString",
        login: {
          uris: [
            {
              uri: "EncryptedString",
              uriChecksum: "EncryptedString",
              match: UriMatchStrategy.Domain,
            },
          ],
          username: "EncryptedString",
          password: "EncryptedString",
          passwordRevisionDate: "2022-01-31T12:00:00.000Z",
          totp: "EncryptedString",
          autofillOnPageLoad: false,
        },
        passwordHistory: [
          { password: "EncryptedString", lastUsedDate: "2022-01-31T12:00:00.000Z" },
        ],
        attachments: [
          {
            id: "a1",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
          {
            id: "a2",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
        ],
        fields: [
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Linked,
            linkedId: LoginLinkedId.Username,
          },
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Linked,
            linkedId: LoginLinkedId.Password,
          },
        ],
      };

      const cipher = new Cipher(cipherData, { lastUsedDate, lastLaunched });
      const sdkCipher = cipher.toSdkCipher();

      expect(sdkCipher).toEqual({
        id: "2afb03fd-0d8e-4c08-a316-18b2f0efa618",
        organizationId: "4748ad12-212e-4bc8-82b7-a75f6709d033",
        folderId: "b4dac811-e44a-495a-9334-9e53b7aaf54c",
        collectionIds: [],
        key: "EncryptedString",
        name: "EncryptedString",
        notes: "EncryptedString",
        type: SdkCipherType.Login,
        login: {
          username: "EncryptedString",
          password: "EncryptedString",
          passwordRevisionDate: "2022-01-31T12:00:00.000Z",
          uris: [
            {
              uri: "EncryptedString",
              uriChecksum: "EncryptedString",
              match: UriMatchType.Domain,
            },
          ],
          totp: "EncryptedString",
          autofillOnPageLoad: false,
          fido2Credentials: undefined,
        },
        identity: undefined,
        card: undefined,
        secureNote: undefined,
        sshKey: undefined,
        favorite: false,
        reprompt: SdkCipherRepromptType.None,
        organizationUseTotp: true,
        edit: true,
        permissions: {
          delete: false,
          restore: false,
        },
        viewPassword: true,
        localData: {
          lastUsedDate: "2025-04-15T12:00:00.000Z",
          lastLaunched: "2025-04-15T12:00:00.000Z",
        },
        attachments: [
          {
            id: "a1",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
          {
            id: "a2",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
        ],
        fields: [
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Linked,
            linkedId: LoginLinkedIdType.Username,
          },
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Linked,
            linkedId: LoginLinkedIdType.Password,
          },
        ],
        passwordHistory: [
          {
            password: "EncryptedString",
            lastUsedDate: "2022-01-31T12:00:00.000Z",
          },
        ],
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        revisionDate: "2022-01-31T12:00:00.000Z",
      });
    });

    it("should map from SDK Cipher", () => {
      jest.restoreAllMocks();
      const sdkCipher: SdkCipher = {
        id: "id" as any,
        organizationId: "orgId" as any,
        folderId: "folderId" as any,
        collectionIds: [],
        key: "EncryptedString" as SdkEncString,
        name: "EncryptedString" as SdkEncString,
        notes: "EncryptedString" as SdkEncString,
        type: SdkCipherType.Login,
        login: {
          username: "EncryptedString" as SdkEncString,
          password: "EncryptedString" as SdkEncString,
          passwordRevisionDate: "2022-01-31T12:00:00.000Z",
          uris: [
            {
              uri: "EncryptedString" as SdkEncString,
              uriChecksum: "EncryptedString" as SdkEncString,
              match: UriMatchType.Domain,
            },
          ],
          totp: "EncryptedString" as SdkEncString,
          autofillOnPageLoad: false,
          fido2Credentials: undefined,
        },
        identity: undefined,
        card: undefined,
        secureNote: undefined,
        sshKey: undefined,
        favorite: false,
        reprompt: SdkCipherRepromptType.None,
        organizationUseTotp: true,
        edit: true,
        permissions: new CipherPermissionsApi(),
        viewPassword: true,
        localData: {
          lastUsedDate: "2025-04-15T12:00:00.000Z",
          lastLaunched: "2025-04-15T12:00:00.000Z",
        },
        attachments: [
          {
            id: "a1",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file" as SdkEncString,
            key: "EncKey" as SdkEncString,
          },
          {
            id: "a2",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file" as SdkEncString,
            key: "EncKey" as SdkEncString,
          },
        ],
        fields: [
          {
            name: "EncryptedString" as SdkEncString,
            value: "EncryptedString" as SdkEncString,
            type: FieldType.Linked,
            linkedId: LoginLinkedIdType.Username,
          },
          {
            name: "EncryptedString" as SdkEncString,
            value: "EncryptedString" as SdkEncString,
            type: FieldType.Linked,
            linkedId: LoginLinkedIdType.Password,
          },
        ],
        passwordHistory: [
          {
            password: "EncryptedString" as SdkEncString,
            lastUsedDate: "2022-01-31T12:00:00.000Z",
          },
        ],
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        archivedDate: undefined,
        revisionDate: "2022-01-31T12:00:00.000Z",
      };

      const lastUsedDate = new Date("2025-04-15T12:00:00.000Z").getTime();
      const lastLaunched = new Date("2025-04-15T12:00:00.000Z").getTime();

      const cipherData: CipherData = {
        id: "id",
        organizationId: "orgId",
        folderId: "folderId",
        edit: true,
        permissions: new CipherPermissionsApi(),
        collectionIds: [],
        viewPassword: true,
        organizationUseTotp: true,
        favorite: false,
        revisionDate: "2022-01-31T12:00:00.000Z",
        type: CipherType.Login,
        name: "EncryptedString",
        notes: "EncryptedString",
        creationDate: "2022-01-01T12:00:00.000Z",
        deletedDate: undefined,
        archivedDate: undefined,
        reprompt: CipherRepromptType.None,
        key: "EncryptedString",
        login: {
          uris: [
            {
              uri: "EncryptedString",
              uriChecksum: "EncryptedString",
              match: UriMatchStrategy.Domain,
            },
          ],
          username: "EncryptedString",
          password: "EncryptedString",
          passwordRevisionDate: "2022-01-31T12:00:00.000Z",
          totp: "EncryptedString",
          autofillOnPageLoad: false,
        },
        passwordHistory: [
          { password: "EncryptedString", lastUsedDate: "2022-01-31T12:00:00.000Z" },
        ],
        attachments: [
          {
            id: "a1",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
          {
            id: "a2",
            url: "url",
            size: "1100",
            sizeName: "1.1 KB",
            fileName: "file",
            key: "EncKey",
          },
        ],
        fields: [
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Linked,
            linkedId: LoginLinkedId.Username,
          },
          {
            name: "EncryptedString",
            value: "EncryptedString",
            type: FieldType.Linked,
            linkedId: LoginLinkedId.Password,
          },
        ],
      };
      const expectedCipher = new Cipher(cipherData, { lastUsedDate, lastLaunched });

      const cipher = Cipher.fromSdkCipher(sdkCipher);

      expect(cipher).toEqual(expectedCipher);
    });
  });
});

const mockUserId = "TestUserId" as UserId;
