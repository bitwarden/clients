import { CipherType } from "../../../../vault/enums";

/** Describes a single field within an item-type Send. */
export interface ItemField {
  label: string;
  value: string;
  /** When true the field value is masked by default (e.g. passwords). */
  hidden?: boolean;
  /** When true a copy-to-clipboard button is rendered. */
  copyable?: boolean;
  /** When set a launch/open button is rendered linking to this URL. */
  launchUrl?: string;
  /** When true the field is rendered as a TOTP countdown. */
  totp?: boolean;
}

/** View model for an item-type Send. */
export class SendItemView {
  name: string = "";
  subtitle: string = "";
  cipherType: CipherType = CipherType.Login;
  fields: ItemField[] = [];
}
