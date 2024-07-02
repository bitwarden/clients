export type ProtonPassJsonFile = {
  version: string;
  userId: string;
  encrypted: boolean;
  vaults: Record<string, ProtonPassVault>;
};

export type ProtonPassVault = {
  name: string;
  description: string;
  display: {
    color: number;
    icon: number;
  };
  items: ProtonPassItem[];
};

export type ProtonPassItem = {
  itemId: string;
  shareId: string;
  data: ProtonPassItemData;
  state: ProtonPassItemState;
  aliasEmail: string | null;
  contentFormatVersion: number;
  createTime: number;
  modifyTime: number;
};

export enum ProtonPassItemState {
  ACTIVE = 1,
  TRASHED = 2,
}

export type ProtonPassItemData = {
  metadata: ProtonPassItemMetadata;
  extraFields: ProtonPassItemExtraField[];
  type: "login" | "alias" | "creditCard" | "note";
  content: ProtonPassLoginItemContent | ProtonPassCreditCardItemContent;
};

export type ProtonPassItemMetadata = {
  name: string;
  note: string;
  itemUuid: string;
};

export type ProtonPassItemExtraField = {
  fieldName: string;
  type: string;
  data: ProtonPassItemExtraFieldData;
};

export type ProtonPassItemExtraFieldData = {
  content?: string;
  totpUri?: string;
};

export type ProtonPassLoginItemContent = {
  itemEmail?: string;
  password?: string;
  urls?: string[];
  totpUri?: string;
  itemUsername?: string;
};

export type ProtonPassCreditCardItemContent = {
  cardholderName?: string;
  cardType?: number;
  number?: string;
  verificationNumber?: string;
  expirationDate?: string;
  pin?: string;
};
