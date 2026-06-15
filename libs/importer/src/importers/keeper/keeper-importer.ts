import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { BaseImporter } from "../base-importer";

export abstract class KeeperImporter extends BaseImporter {
  constructor(protected configService: ConfigService) {
    super();
  }

  protected copyLoginPropertiesAsCustomFields(cipher: CipherView) {
    if (!this.isNullOrWhitespace(cipher.login.username)) {
      this.addField(cipher, "Username", cipher.login.username!);
      cipher.login.username = undefined;
    }

    if (!this.isNullOrWhitespace(cipher.login.password)) {
      this.addField(cipher, "Password", cipher.login.password!, FieldType.Hidden);
      cipher.login.password = undefined;
    }

    if (cipher.login.uris) {
      cipher.login.uris.forEach((uri, index) => {
        this.addField(cipher, "URL", uri.uri);
      });
      cipher.login.uris = [];
    }
  }

  protected addField(
    cipher: CipherView,
    name: string,
    value: any,
    type: FieldType = FieldType.Text,
  ) {
    if (!value) {
      return;
    }

    const field = new FieldView();
    field.type = type;
    field.name = name;
    field.value = this.convertToFieldValue(value);
    cipher.fields.push(field);
  }

  // Just to be safe, value come in all kinds of flavors
  protected convertToFieldValue(value: any): string {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      // Fallthrough
    }

    return "";
  }
}
