// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { FieldView as SdkFieldView, FieldType as SdkFieldType } from "@bitwarden/sdk-internal";

import { View } from "../../../models/view/view";
import { FieldType, LinkedIdType } from "../../enums";
import { Field } from "../domain/field";

export class FieldView implements View {
  name: string = null;
  value: string = null;
  type: FieldType = null;
  newField = false; // Marks if the field is new and hasn't been saved
  showValue = false;
  showCount = false;
  linkedId: LinkedIdType = null;

  constructor(f?: Field) {
    if (!f) {
      return;
    }

    this.type = f.type;
    this.linkedId = f.linkedId;
  }

  get maskedValue(): string {
    return this.value != null ? "••••••••" : null;
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
