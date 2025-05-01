// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherWithIdExport } from "@bitwarden/common/models/export/cipher-with-ids.export";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BaseResponse } from "../../models/response/base.response";
import { LoginResponse } from "../../models/response/login.response";

import { AttachmentResponse } from "./attachment.response";
import { PasswordHistoryResponse } from "./password-history.response";

export class CipherResponse extends CipherWithIdExport implements BaseResponse {
  object: string;
  attachments: AttachmentResponse[];
  revisionDate: Date;
  creationDate: Date;
  deletedDate: Date;
  passwordHistory: PasswordHistoryResponse[];

  constructor(o: CipherView) {
    super();
    this.object = "item";
    this.build(o);
    if (o.attachments != null) {
      this.attachments = o.attachments.map((a) => new AttachmentResponse(a));
    }
    this.revisionDate = o.revisionDate;
    if (o.creationDate != null) {
      this.creationDate = o.creationDate;
    }
    this.deletedDate = o.deletedDate;
    if (o.passwordHistory != null) {
      this.passwordHistory = o.passwordHistory.map((h) => new PasswordHistoryResponse(h));
    }
    if (o.type === CipherType.Login && o.login != null) {
      this.login = new LoginResponse(o.login);
    }
  }
}
