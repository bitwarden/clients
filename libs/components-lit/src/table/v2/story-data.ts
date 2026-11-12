// Example data shared by the table v2 stories, ported from the Angular stories.
import type { IconTileVariant } from "../../icon-tile/icon-tile";

/** The item types the spec's Type sheet lists, plus `note`. */
export const VAULT_ITEM_TYPES = [
  { value: "login", label: "Login" },
  { value: "card", label: "Card" },
  { value: "bankAccount", label: "Bank account" },
  { value: "identity", label: "Identity" },
  { value: "sshKey", label: "SSH key" },
  { value: "note", label: "Secure note" },
] as const;

export type VaultItemType = (typeof VAULT_ITEM_TYPES)[number]["value"];

export const typeLabel = (type: VaultItemType) =>
  VAULT_ITEM_TYPES.find((entry) => entry.value === type)?.label ?? type;

export type VaultRow = {
  id: number;
  name: string;
  type: VaultItemType;
  vault: "mine" | "acme";
  collectionIds: string[];
  /** `null` is the spec's "No folders" option. */
  folderId: string | null;
  favorite: boolean;
};

export const VAULT_ROWS: VaultRow[] = [
  {
    id: 1,
    name: "Acme",
    type: "login",
    vault: "acme",
    collectionIds: ["eng"],
    folderId: "work",
    favorite: true,
  },
  {
    id: 2,
    name: "Amazon",
    type: "login",
    vault: "mine",
    collectionIds: [],
    folderId: "entertainment",
    favorite: false,
  },
  {
    id: 3,
    name: "Apple ID",
    type: "login",
    vault: "mine",
    collectionIds: [],
    folderId: null,
    favorite: true,
  },
  {
    id: 4,
    name: "Chase Bank",
    type: "card",
    vault: "acme",
    collectionIds: ["ops"],
    folderId: null,
    favorite: false,
  },
  {
    id: 5,
    name: "Corporate amex",
    type: "card",
    vault: "acme",
    collectionIds: ["ops", "eng"],
    folderId: "work",
    favorite: true,
  },
  {
    id: 6,
    name: "Datadog",
    type: "login",
    vault: "acme",
    collectionIds: ["eng"],
    folderId: "utilities",
    favorite: false,
  },
  {
    id: 7,
    name: "Docusign",
    type: "login",
    vault: "acme",
    collectionIds: ["ops"],
    folderId: "healthcare",
    favorite: false,
  },
  {
    id: 8,
    name: "Recovery codes",
    type: "note",
    vault: "mine",
    collectionIds: ["personal"],
    folderId: "social",
    favorite: false,
  },
  {
    id: 9,
    name: "Wifi password",
    type: "note",
    vault: "acme",
    collectionIds: ["pm"],
    folderId: "subscriptions",
    favorite: false,
  },
  {
    id: 10,
    name: "GitHub",
    type: "login",
    vault: "acme",
    collectionIds: ["eng"],
    folderId: "work",
    favorite: false,
  },
  {
    id: 11,
    name: "Chase checking",
    type: "bankAccount",
    vault: "mine",
    collectionIds: [],
    folderId: "subscriptions",
    favorite: false,
  },
  {
    id: 12,
    name: "Wells Fargo savings",
    type: "bankAccount",
    vault: "mine",
    collectionIds: [],
    folderId: null,
    favorite: false,
  },
  {
    id: 13,
    name: "Home address",
    type: "identity",
    vault: "mine",
    collectionIds: [],
    folderId: "utilities",
    favorite: false,
  },
  {
    id: 14,
    name: "Work identity",
    type: "identity",
    vault: "acme",
    collectionIds: ["ops"],
    folderId: "work",
    favorite: false,
  },
  {
    id: 15,
    name: "Deploy key",
    type: "sshKey",
    vault: "acme",
    collectionIds: ["eng", "ci"],
    folderId: null,
    favorite: false,
  },
];

export const VAULTS = [
  { id: "mine", name: "My vault" },
  { id: "acme", name: "Acme corporation" },
] as const;

/**
 * Matches the spec's My folders sheet: "No folders" is the `null` option, and each folder
 * carries its own tag tile colour. There is no pink in the decorative families, so
 * Subscriptions uses `brand`.
 */
export const FOLDERS = [
  { id: "entertainment", name: "Entertainment", variant: "green" },
  { id: "healthcare", name: "Healthcare", variant: "red" },
  { id: "social", name: "Social media", variant: "orange" },
  { id: "subscriptions", name: "Subscriptions", variant: "brand" },
  { id: "utilities", name: "Utilities", variant: "purple" },
  { id: "work", name: "Work", variant: "gray" },
] as const satisfies readonly { id: string; name: string; variant: IconTileVariant }[];

export const COLLECTION_ORGS = [
  {
    name: "Acme corporation",
    collections: [
      {
        id: "eng",
        name: "Engineering",
        children: [
          { id: "monitoring", name: "Monitoring" },
          { id: "infra", name: "Infrastructure", children: [{ id: "ci", name: "CI/CD" }] },
        ],
      },
      { id: "ops", name: "Operations" },
      { id: "pm", name: "Project management" },
      { id: "security", name: "Security" },
      { id: "design", name: "Design" },
      { id: "marketing", name: "Marketing" },
      { id: "sales", name: "Sales" },
    ],
  },
  {
    name: "My vault",
    collections: [
      { id: "personal", name: "Personal" },
      { id: "finance", name: "Finance" },
      { id: "travel", name: "Travel" },
    ],
  },
];

export type VaultFilters = {
  search?: string;
  type?: VaultRow["type"];
  vault?: string[];
  collection?: string[];
  folder?: (string | null)[];
  favorite?: boolean;
};

export type SeatRow = { id: number; name: string; email: string };

export const SEAT_ROWS: SeatRow[] = [
  { id: 1, name: "Alex Chen", email: "alex.chen@example.com" },
  { id: 2, name: "Sam Rivera", email: "sam.rivera@example.com" },
  { id: 3, name: "Jordan Park", email: "jordan.park@example.com" },
  { id: 4, name: "Robin Vale", email: "robin.vale@example.com" },
];

export type LongLabelRow = { id: number; name: string; collectionIds: string[]; folderId: string };
export type LongLabelFilters = { search?: string; collection?: string[]; folder?: string[] };

export const LONG_LABEL_ORG = "Bitwarden Design System and Component Library";

export const LONG_LABEL_COLLECTIONS = [
  { id: "onboarding", name: "Onboarding materials for new design system contributors" },
  { id: "tokens", name: "Design tokens, themes, and every palette we publish" },
];

export const LONG_LABEL_FOLDERS = [
  { id: "household", name: "Household paperwork, warranties, and appliance manuals" },
  { id: "subscriptions", name: "Streaming subscriptions I keep meaning to cancel" },
];

export const LONG_LABEL_ROWS: LongLabelRow[] = [
  {
    id: 1,
    name: "Design system handbook",
    collectionIds: ["onboarding"],
    folderId: "household",
  },
  { id: 2, name: "Palette generator", collectionIds: ["tokens"], folderId: "subscriptions" },
  {
    id: 3,
    name: "Contributor checklist",
    collectionIds: ["onboarding", "tokens"],
    folderId: "household",
  },
];
