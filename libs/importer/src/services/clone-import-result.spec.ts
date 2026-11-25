import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../models/import-result";

import { cloneImportResult } from "./clone-import-result";

function sampleResult(): ImportResult {
  const login = new CipherView();
  login.type = CipherType.Login;
  login.name = "Example";
  login.notes = "note";
  login.favorite = true;
  login.folderId = "folder-1";
  login.login = new LoginView();
  login.login.username = "user";
  login.login.password = "secret";
  login.login.totp = "otpauth://totp/x";
  const uri = new LoginUriView();
  uri.uri = "https://example.com";
  login.login.uris = [uri];
  const field = new FieldView();
  field.name = "f";
  field.value = "v";
  login.fields = [field];
  login.creationDate = new Date("2024-01-02T03:04:05.000Z");

  const card = new CipherView();
  card.type = CipherType.Card;
  card.name = "Visa";
  card.card = new CardView();
  card.card.number = "4111111111111111";
  card.card.cardholderName = "A. Person";

  const identity = new CipherView();
  identity.type = CipherType.Identity;
  identity.name = "Me";
  identity.identity = new IdentityView();
  identity.identity.firstName = "A";
  identity.identity.lastName = "Person";

  const note = new CipherView();
  note.type = CipherType.SecureNote;
  note.name = "Note";
  note.secureNote = new SecureNoteView();

  const folder = new FolderView();
  folder.id = "folder-1";
  folder.name = "Work";

  const collection = new CollectionView({
    id: "col-1" as CollectionId,
    organizationId: "org-1" as OrganizationId,
    name: "Shared",
  });
  collection.type = CollectionTypes.SharedCollection;

  const result = new ImportResult();
  result.success = true;
  result.ciphers = [login, card, identity, note];
  result.folders = [folder];
  result.folderRelationships = [[0, 0]];
  result.collections = [collection];
  result.collectionRelationships = [[1, 0]];
  return result;
}

describe("cloneImportResult", () => {
  it("copies every cipher type, folder and collection with its fields intact", () => {
    const original = sampleResult();

    const copy = cloneImportResult(original);

    expect(copy.ciphers).toEqual(original.ciphers);
    expect(copy.folders).toEqual(original.folders);
    expect(copy.collections).toEqual(original.collections);
    expect(copy.folderRelationships).toEqual(original.folderRelationships);
    expect(copy.collectionRelationships).toEqual(original.collectionRelationships);
    expect(copy.success).toBe(true);
  });

  it("returns real view instances", () => {
    const copy = cloneImportResult(sampleResult());

    expect(copy.ciphers.every((c) => c instanceof CipherView)).toBe(true);
    expect(copy.folders[0]).toBeInstanceOf(FolderView);
    expect(copy.collections[0]).toBeInstanceOf(CollectionView);
    expect(copy.collections[0].name).toBe("Shared");
    expect(copy.ciphers[0].creationDate).toEqual(new Date("2024-01-02T03:04:05.000Z"));
  });

  it("shares nothing with the original", () => {
    const original = sampleResult();

    const copy = cloneImportResult(original);
    copy.ciphers[0].organizationId = "org-1";
    copy.ciphers[0].login.username = "changed";
    copy.folderRelationships.push([9, 9]);
    copy.collectionRelationships[0][1] = 5;
    copy.collections = [];

    expect(original.ciphers[0].organizationId).toBeUndefined();
    expect(original.ciphers[0].login.username).toBe("user");
    expect(original.folderRelationships).toEqual([[0, 0]]);
    expect(original.collectionRelationships).toEqual([[1, 0]]);
    expect(original.collections).toHaveLength(1);
  });

  it("copies the target-included flags and skipped-item errors", () => {
    const original = sampleResult();
    original.targetFolderIncluded = true;
    original.targetCollectionIncluded = true;
    original.errors = [{ index: 1 } as never];

    const copy = cloneImportResult(original);

    expect(copy.targetFolderIncluded).toBe(true);
    expect(copy.targetCollectionIncluded).toBe(true);
    expect(copy.errors).toEqual(original.errors);
    expect(copy.errors).not.toBe(original.errors);
  });
});
