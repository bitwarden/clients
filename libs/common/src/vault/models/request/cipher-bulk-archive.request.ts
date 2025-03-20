// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class CipherBulkArchiveRequest {
  ids: string[];

  constructor(ids: string[]) {
    this.ids = ids == null ? [] : ids;
  }
}
