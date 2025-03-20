import { CipherId } from "@bitwarden/common/types/guid";

export class CipherBulkArchiveRequest {
  ids: CipherId[];

  constructor(ids: CipherId[]) {
    this.ids = ids == null ? [] : ids;
  }
}

export class CipherBulkUnarchiveRequest {
  ids: CipherId[];

  constructor(ids: CipherId[]) {
    this.ids = ids == null ? [] : ids;
  }
}
