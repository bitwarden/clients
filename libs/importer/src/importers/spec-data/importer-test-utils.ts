import { FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

type FieldViewExpectation = [string, string] | [string, string, FieldType];

/** Assert that a cipher's custom fields include at least one that match each entry of the passed-in
 * structure (expressed as an array of either name-value or name-value-type tuples) */
export function assertCustomFieldsExist(
  fields: FieldView[],
  expectedFields: FieldViewExpectation[],
) {
  for (const field of expectedFields) {
    const customFieldIdx = fields.findIndex((f) => f.name === field[0]);
    expect(customFieldIdx).not.toEqual(-1);
    const customField = fields[customFieldIdx];
    expect(customField.value).toEqual(field[1]);
    if (field[2]) {
      expect(customField.type).toEqual(field[2]);
    }
  }
}

/** Assert that a cipher's custom fields exactly match the passed-in structure
 * (expressed as an array of either name-value or name-value-type tuples) */
export function assertCustomFieldsStructure(
  actualFields: FieldView[],
  expectedFields: FieldViewExpectation[],
) {
  expect(actualFields.length).toEqual(expectedFields.length);
  for (let i = 0; i < expectedFields.length; i++) {
    try {
      expect(actualFields[i].name).toEqual(expectedFields[i][0]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new Error(
        `Expected custom field name ${expectedFields[i][0]}, received ${actualFields[i].name}`,
      );
    }
    try {
      expect(actualFields[i].value).toEqual(expectedFields[i][1]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new Error(
        `Expected custom field value ${expectedFields[i][1]}, received ${actualFields[i].value}`,
      );
    }
    if (expectedFields[i].length === 3) {
      try {
        expect(actualFields[i].type).toEqual(expectedFields[i][2]);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        throw new Error(
          `Expected custom field type ${expectedFields[i][2]}, received ${actualFields[i].type}`,
        );
      }
    }
  }
}
