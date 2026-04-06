// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class CipherBulkRestoreRequest {
  ids: string[];
  organizationId: string;

  constructor(ids: string[], organizationId?: string) {
    this.ids = ids == null ? [] : ids;
    this.organizationId = organizationId;
  }
}
