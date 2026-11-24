import { EncString } from "@bitwarden/sdk-internal";

import { FieldType, LinkedIdType } from "../../vault/enums";
import { Field as FieldDomain } from "../../vault/models/domain/field";
import { FieldView } from "../../vault/models/view/field.view";

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
    domain.value = req.value != null ? (req.value as EncString) : undefined;
    domain.name = req.name != null ? (req.name as EncString) : undefined;
    domain.linkedId = req.linkedId;
    return domain;
  }

  name?: string;
  value?: string;
  type: FieldType = FieldType.Text;
  linkedId?: LinkedIdType;

  constructor(o?: FieldView | FieldDomain) {
    if (o == null) {
      return;
    }

    this.name = o.name ?? undefined;
    this.value = o.value ?? undefined;
    this.type = o.type;
    this.linkedId = o.linkedId;
  }
}
