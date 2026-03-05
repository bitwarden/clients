import { Jsonify } from "type-fest";

import { FieldView as SdkFieldView, FieldType as SdkFieldType } from "@bitwarden/sdk-internal";

import { View } from "../../../models/view/view";
import { FieldType, LinkedIdType } from "../../enums";
import { Field } from "../domain/field";

export class FieldView implements View {
  name?: string;
  value?: string;
  type: FieldType = FieldType.Text;
  newField = false; // Marks if the field is new and hasn't been saved
  showValue = false;
  showCount = false;
  linkedId?: LinkedIdType;

  constructor(f?: Field) {
    if (!f) {
      return;
    }

    this.type = f.type;
    this.linkedId = f.linkedId;
  }

  get maskedValue(): string | undefined {
    return this.value != null ? "••••••••" : undefined;
  }

  static fromJSON(obj: Partial<Jsonify<FieldView>>): FieldView {
    return Object.assign(new FieldView(), obj);
  }

  /**
   * Converts the SDK FieldView to a FieldView.
   */
  static fromSdkFieldView(obj: SdkFieldView): FieldView | undefined {
    if (!obj) {
      return undefined;
    }

    const view = new FieldView();
    view.name = obj.name;
    view.value = obj.value;
    view.type = obj.type;
    view.linkedId = obj.linkedId as unknown as LinkedIdType;

    return view;
  }

  /**
   * Converts the FieldView to an SDK FieldView.
   */
  toSdkFieldView(): SdkFieldView {
    return {
      name: this.name ?? undefined,
      value: this.value ?? undefined,
      type: this.type ?? SdkFieldType.Text,
      linkedId: this.linkedId ?? undefined,
    };
  }
}
