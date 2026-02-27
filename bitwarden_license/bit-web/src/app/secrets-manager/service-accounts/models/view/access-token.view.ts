// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class AccessTokenView {
  id: string;
  name: string;
  scopes: string[];
  expireAt?: Date;
  creationDate: Date;
  revisionDate: Date;
}
