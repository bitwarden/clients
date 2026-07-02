import { FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

/** Assert that a cipher's custom fields include one that matches the passed-in name, value, and (optionally) type */
export function assertCustomFieldExists(
  fields: FieldView[],
  name: string,
  value: string,
  type?: FieldType,
) {
  const customFieldIdx = fields.findIndex((f) => f.name === name);
  expect(customFieldIdx).not.toEqual(-1);
  const customField = fields[customFieldIdx];
  expect(customField.value).toEqual(value);
  if (type) {
    expect(customField.type).toEqual(type);
  }
}

/** Assert that a cipher's custom fields exactly match the passed-in structure (expressed as an array of name-value tuples) */
export function assertFieldsStructure(
  actualFields: FieldView[],
  expectedFields: [string, string][],
) {
  expect(actualFields.length).toEqual(expectedFields.length);
  for (let i = 0; i < expectedFields.length; i++) {
    expect(actualFields[i].name).toEqual(expectedFields[i][0]);
    expect(actualFields[i].value).toEqual(expectedFields[i][1]);
  }
}
