import { ProductTierType } from "@bitwarden/common/billing/enums";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { InlineMenuCipherData } from "../../background/abstractions/overlay.background";
import { CipherTypes, CipherRepromptTypes } from "../../content/components/cipher/types";
import {
  CollectionView,
  FolderView,
  NotificationCipher,
  OrgView,
} from "../notification/notification.types";

const noFavicon = { imageEnabled: false, image: "", fallbackImage: "", icon: "bwi-globe" };

export const mockOrganizations: OrgView[] = [
  { id: "org-1", name: "Acme, Inc.", productTierType: ProductTierType.Teams },
  { id: "org-2", name: "Family Vault", productTierType: ProductTierType.Families },
  {
    id: "org-3",
    name: "A Really Long Business Name That Just Kinda Goes On For A Really Long Time",
    productTierType: ProductTierType.Enterprise,
  },
];

export const mockFolders: FolderView[] = [
  { id: "", name: "No folder" },
  { id: "folder-1", name: "Work" },
  { id: "folder-2", name: "Personal" },
  { id: "folder-3", name: "Something else entirely, with a name that keeps going" },
];

export const mockCollections: CollectionView[] = [
  { id: "collection-1", name: "Engineering", organizationId: "org-1" },
  { id: "collection-2", name: "Marketing", organizationId: "org-1" },
];

export const mockNotificationCiphers: NotificationCipher[] = [
  {
    id: "cipher-1",
    name: "Example login",
    type: CipherTypes.Login,
    favorite: false,
    reprompt: CipherRepromptTypes.None,
    icon: noFavicon,
    login: { username: "user@example.com" },
  },
  {
    id: "cipher-2",
    name: "Shared work login",
    type: CipherTypes.Login,
    favorite: false,
    reprompt: CipherRepromptTypes.None,
    icon: noFavicon,
    login: { username: "jane.doe@acme.example" },
    organizationCategories: ["business"],
  },
];

function makeCipher(
  overrides: Partial<InlineMenuCipherData> & Pick<InlineMenuCipherData, "id" | "name" | "type">,
): InlineMenuCipherData {
  return { favorite: false, reprompt: CipherRepromptType.None, icon: noFavicon, ...overrides };
}

export const mockLoginCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "login-1",
    name: "Bitwarden",
    type: CipherType.Login,
    login: { username: "test@bitwarden.com", passkey: null },
  }),
  makeCipher({
    id: "login-2",
    name: "GitHub",
    type: CipherType.Login,
    login: { username: "codestradamus", passkey: null },
  }),
  makeCipher({
    id: "login-3",
    name: "A login with a very long name that should truncate",
    type: CipherType.Login,
    login: { username: "long.username@example.com", passkey: null },
  }),
];

export const mockTotpCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "totp-1",
    name: "Bitwarden",
    type: CipherType.Login,
    login: {
      username: "test@bitwarden.com",
      totp: "123456",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  }),
  makeCipher({
    id: "totp-2",
    name: "GitHub",
    type: CipherType.Login,
    reprompt: CipherRepromptType.Password,
    login: {
      username: "codestradamus",
      totp: "654321",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  }),
];

export const mockPasskeyCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "passkey-1",
    name: "Bitwarden",
    type: CipherType.Login,
    login: {
      username: "test@bitwarden.com",
      passkey: { rpName: "bitwarden.com", userName: "test@bitwarden.com" },
    },
  }),
  makeCipher({
    id: "passkey-2",
    name: "webauthn.io",
    type: CipherType.Login,
    login: { passkey: { rpName: "webauthn.io", userName: "passkey-user" } },
  }),
];

export const mockPasskeysAndPasswords: InlineMenuCipherData[] = [
  ...mockPasskeyCiphers,
  makeCipher({
    id: "password-1",
    name: "Bitwarden",
    type: CipherType.Login,
    login: { username: "password-user@bitwarden.com", passkey: null },
  }),
];

export const mockCardCiphers: InlineMenuCipherData[] = [
  makeCipher({ id: "card-1", name: "Personal Visa", type: CipherType.Card, card: "Visa, *4242" }),
  makeCipher({ id: "card-2", name: "Work card", type: CipherType.Card, card: "*1234" }),
];

export const mockIdentityCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "identity-1",
    name: "Personal",
    type: CipherType.Identity,
    identity: { fullName: "Jane Doe" },
  }),
  makeCipher({
    id: "identity-2",
    name: "Work",
    type: CipherType.Identity,
    identity: { fullName: "Jane Doe", username: "jane.doe@bitwarden.com" },
  }),
];
