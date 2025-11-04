import { EncString } from "../../key-management/crypto/models/enc-string";
import { FieldType, LinkedIdType } from "../../vault/enums";
import { Field as FieldDomain } from "../../vault/models/domain/field";
import { FieldView } from "../../vault/models/view/field.view";

import { safeGetString } from "./utils";

export class FieldExport {
  static template(): FieldExport {
    const req = new FieldExport();
    req.name = "Field name";
    req.value = "Some value";
    req.type = FieldType.Text;
    return req;
  }

  static toView(req: FieldExport, view = new FieldView()) {
    view.type = req.type;
    view.value = req.value;
    view.name = req.name;
    view.linkedId = req.linkedId;
    return view;
  }

  static toDomain(req: FieldExport, domain = new FieldDomain()) {
    domain.type = req.type;
    domain.value = new EncString(req.value ?? "");
    domain.name = new EncString(req.name ?? "");
    domain.linkedId = req.linkedId;
    return domain;
  }

  name: string = "";
  value: string = "";
  type: FieldType = FieldType.Text;
  linkedId?: LinkedIdType;

  constructor(o?: FieldView | FieldDomain) {
    if (o == null) {
      return;
    }

    this.name = safeGetString(o.name ?? "") ?? "";
    this.value = safeGetString(o.value ?? "") ?? "";
    this.type = o.type;
    this.linkedId = o.linkedId;
  }
}
