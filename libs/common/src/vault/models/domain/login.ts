import { Jsonify } from "type-fest";

import Domain from "../../../models/domain/domain-base";
import { EncString } from "../../../models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { Guid } from "../../../types/guid";
import { LoginData } from "../data/login.data";
import { LoginView } from "../view/login.view";

import { LoginUri } from "./login-uri";

export class Login extends Domain {
  uris: LoginUri[];
  username: EncString;
  password: EncString;
  passwordRevisionDate?: Date;
  totp: EncString;
  autofillOnPageLoad: boolean;

  constructor(obj?: LoginData) {
    super();
    if (obj == null) {
      return;
    }

    this.passwordRevisionDate =
      obj.passwordRevisionDate != null ? new Date(obj.passwordRevisionDate) : null;
    this.autofillOnPageLoad = obj.autofillOnPageLoad;
    this.buildDomainModel(
      this,
      obj,
      {
        username: null,
        password: null,
        totp: null,
      },
      []
    );

    if (obj.uris) {
      this.uris = [];
      obj.uris.forEach((u) => {
        this.uris.push(new LoginUri(u));
      });
    }
  }

  async decrypt(orgId: Guid, encKey?: SymmetricCryptoKey): Promise<LoginView> {
    const view = await this.decryptObj(
      new LoginView(this),
      {
        username: null,
        password: null,
        totp: null,
      },
      orgId,
      encKey
    );

    if (this.uris != null) {
      view.uris = [];
      for (let i = 0; i < this.uris.length; i++) {
        const uri = await this.uris[i].decrypt(orgId, encKey);
        view.uris.push(uri);
      }
    }

    return view;
  }

  toLoginData(): LoginData {
    const l = new LoginData();
    l.passwordRevisionDate =
      this.passwordRevisionDate != null ? this.passwordRevisionDate.toISOString() : null;
    l.autofillOnPageLoad = this.autofillOnPageLoad;
    this.buildDataModel(this, l, {
      username: null,
      password: null,
      totp: null,
    });

    if (this.uris != null && this.uris.length > 0) {
      l.uris = [];
      this.uris.forEach((u) => {
        l.uris.push(u.toLoginUriData());
      });
    }

    return l;
  }

  static fromJSON(obj: Partial<Jsonify<Login>>): Login {
    if (obj == null) {
      return null;
    }

    const username = EncString.fromJSON(obj.username);
    const password = EncString.fromJSON(obj.password);
    const totp = EncString.fromJSON(obj.totp);
    const passwordRevisionDate =
      obj.passwordRevisionDate == null ? null : new Date(obj.passwordRevisionDate);
    const uris = obj.uris?.map((uri: any) => LoginUri.fromJSON(uri));

    return Object.assign(new Login(), obj, {
      username,
      password,
      totp,
      passwordRevisionDate: passwordRevisionDate,
      uris: uris,
    });
  }
}
