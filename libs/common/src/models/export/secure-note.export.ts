// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecureNoteType } from "../../vault/enums";
import { SecureNote as SecureNoteDomain } from "../../vault/models/domain/secure-note";
import { SecureNoteView } from "../../vault/models/view/secure-note.view";

export class SecureNoteExport {
  static template(): SecureNoteExport {
    const req = new SecureNoteExport();
    req.type = SecureNoteType.Generic;
    return req;
  }

  static toView(req: SecureNoteExport, view = new SecureNoteView()) {
    view.type = req.type;
    return view;
  }

  static toDomain(req: SecureNoteExport, view = new SecureNoteDomain()) {
    view.type = req.type;
    return view;
  }

  type: SecureNoteType;

  constructor(o?: SecureNoteView | SecureNoteDomain) {
    if (o == null) {
      return;
    }

    this.type = o.type;
  }
}
