// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "../../../models/view/view";
import { LinkedMetadata } from "../../linked-field-option.decorator";

export abstract class ItemView implements View {
  linkedFieldOptions: Map<number, LinkedMetadata>;
  abstract get subTitle(): string;
}
