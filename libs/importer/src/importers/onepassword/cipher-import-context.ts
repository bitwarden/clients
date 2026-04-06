import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export class CipherImportContext {
  lowerProperty: string;
  constructor(
    public importRecord: any,
    public property: string,
    public cipher: CipherView,
  ) {
    this.lowerProperty = property.toLowerCase();
  }
}
