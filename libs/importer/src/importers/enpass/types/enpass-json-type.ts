import { EnpassItemTemplate } from "./enpass-item-templates";

export type EnpassJsonFile = {
  folders: EnpassFolder[];
  items: EnpassItem[];
};

export type EnpassFolder = {
  icon: string;
  parent_uuid: string;
  title: string;
  updated_at: number;
  uuid: string;
};

export type EnpassItem = {
  archived: number;
  auto_submit: number;
  category: string;
  createdAt: number;
  favorite: number;
  fields?: EnpassField[];
  icon: Icon;
  note: string;
  subtitle: string;
  template_type: EnpassItemTemplate;
  title: string;
  trashed: number;
  updated_at: number;
  uuid: string;
  folders?: string[];
};

export type EnpassFieldType =
  | "text"
  | "password"
  | "pin"
  | "numeric"
  | "date"
  | "email"
  | "url"
  | "phone"
  | "username"
  | "totp"
  | "multiline"
  | "ccName"
  | "ccNumber"
  | "ccCvc"
  | "ccPin"
  | "ccExpiry"
  | "ccBankname"
  | "ccTxnpassword"
  | "ccType"
  | "ccValidfrom"
  | "section"
  | ".Android#";

export type EnpassField = {
  deleted: number;
  history?: History[];
  label: string;
  order: number;
  sensitive: number;
  type: EnpassFieldType;
  uid: number;
  updated_at: number;
  value: string;
  value_updated_at: number;
};

export type History = {
  updated_at: number;
  value: string;
};

export type Icon = {
  fav: string;
  image: Image;
  type: number;
  uuid: string;
};

export type Image = {
  file: string;
};
