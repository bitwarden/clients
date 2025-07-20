// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export type InitiationPath =
  | "Registration form"
  | "Password Manager trial from marketing website"
  | "Secrets Manager trial from marketing website"
  | "New organization creation in-product"
  | "Upgrade in-product";

export class ReferenceEventRequest {
  id: string;
  session: string;
  layout: string;
  flow: string;
  initiationPath: InitiationPath;
}
