// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LinkedIdType } from "./enums";
import { ItemView } from "./models/view/item.view";

type LinkedMetadataAttributes = {
  /**
   * The i18n key used to describe the decorated class property in the UI.
   * If it is null, then the name of the class property will be used as the i18n key.
   */
  i18nKey?: string;

  /**
   * The position of the individual field to be applied when sorted.
   */
  sortPosition: number;
};

export class LinkedMetadata {
  private readonly _i18nKey: string;
  readonly sortPosition: number;

  constructor(
    readonly propertyKey: string,
    attributes: LinkedMetadataAttributes,
  ) {
    this._i18nKey = attributes?.i18nKey;
    this.sortPosition = attributes.sortPosition;
  }

  get i18nKey() {
    return this._i18nKey ?? this.propertyKey;
  }
}

/**
 * A decorator used to set metadata used by Linked custom fields. Apply it to a class property or getter to make it
 *    available as a Linked custom field option.
 * @param id - A unique value that is saved in the Field model. It is used to look up the decorated class property.
 * @param options - {@link LinkedMetadataAttributes}
 */
export function linkedFieldOption(id: LinkedIdType, attributes: LinkedMetadataAttributes) {
  return (prototype: ItemView, propertyKey: string) => {
    if (prototype.linkedFieldOptions == null) {
      prototype.linkedFieldOptions = new Map<LinkedIdType, LinkedMetadata>();
    }

    prototype.linkedFieldOptions.set(id, new LinkedMetadata(propertyKey, attributes));
  };
}
