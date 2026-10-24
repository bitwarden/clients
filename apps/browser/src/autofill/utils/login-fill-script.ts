import { InlineMenuFillTypes, type InlineMenuFillType } from "../enums/autofill-overlay.enum";
import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript from "../models/autofill-script";
import { AutoFillConstants } from "../services/autofill-constants";

import { fieldContainsKeyword, isNonLoginFormContext } from "./qualification";

/**
 * Login fill script generation with no dependency on the vault, background services or the
 * extension runtime. Shared by the main extension's AutofillService and by apps/cloud-fill.
 */

export type LoginFillCredential = {
  username?: string | null;
  password?: string | null;
  /** Truthy when a TOTP code can be supplied at completion time. */
  totp?: string | null;
};

export type LoginFillOptions = {
  skipUsernameOnlyFill: boolean;
  onlyEmptyFields: boolean;
  fillNewPassword: boolean;
  allowTotpAutofill: boolean;
  autoSubmitLogin: boolean;
  focusedFieldOpid?: string;
  inlineMenuFillType?: InlineMenuFillType;
};

type FieldFinder = (
  pageDetails: AutofillPageDetails,
  passwordField: AutofillField,
  canBeHidden: boolean,
  canBeReadOnly: boolean,
  withoutForm: boolean,
) => AutofillField | null;

/** Hooks that let a caller observe or replace the field heuristics. */
export type LoginFillHelpers = {
  findUsernameField: FieldFinder;
  findTotpField: FieldFinder;
  isRegistrationPasswordField: (
    pageDetails: AutofillPageDetails,
    passwordField: AutofillField,
  ) => boolean;
};

export type LoginFillPlan = {
  fillScript: AutofillScript;
  filledFields: { [id: string]: AutofillField };
  totps: AutofillField[];
  /** True when the script is complete and no TOTP step applies. */
  final: boolean;
};

const searchFieldNamesSet = new Set(AutoFillConstants.SearchFieldNames);

export function hasValue(str: string): boolean {
  return Boolean(str && str !== "");
}

export function forCustomFieldsOnly(field: AutofillField): boolean {
  return field.tagName === "span";
}

export function autoCompleteTypeIncludesToken(
  autoCompleteType: string | null | undefined,
  token: string,
): boolean {
  if (autoCompleteType == null || typeof autoCompleteType !== "string") {
    return false;
  }

  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) {
    return false;
  }

  const parts = autoCompleteType.trim().toLowerCase().split(/\s+/);
  return parts.includes(normalizedToken);
}

export function fillByOpid(fillScript: AutofillScript, field: AutofillField, value: string): void {
  if (field.maxLength && value && value.length > field.maxLength) {
    value = value.substr(0, value.length);
  }
  if (field.tagName !== "span") {
    fillScript.script.push(["click_on_opid", field.opid]);
    fillScript.script.push(["focus_by_opid", field.opid]);
  }
  fillScript.script.push(["fill_by_opid", field.opid, value]);
}

export function setFillScriptForFocus(
  filledFields: { [id: string]: AutofillField },
  fillScript: AutofillScript,
): AutofillScript {
  let lastField: AutofillField | null = null;
  let lastPasswordField: AutofillField | null = null;

  for (const opid in filledFields) {
    if (Object.prototype.hasOwnProperty.call(filledFields, opid) && filledFields[opid].viewable) {
      lastField = filledFields[opid];

      if (filledFields[opid].type === "password") {
        lastPasswordField = filledFields[opid];
      }
    }
  }

  // Prioritize password field over others.
  if (lastPasswordField?.opid != null) {
    fillScript.script.push(["focus_by_opid", lastPasswordField.opid]);
  } else if (lastField?.opid != null) {
    fillScript.script.push(["focus_by_opid", lastField.opid]);
  }

  return fillScript;
}

function isExcludedType(type: string, excludedTypes: string[]) {
  return excludedTypes.indexOf(type) > -1;
}

/** Identifies fields whose attributes mark them as search inputs. */
export function isSearchField(field: AutofillField) {
  const matchFieldAttributeValues = [field.type, field.htmlName, field.htmlID, field.placeholder];
  for (let attrIndex = 0; attrIndex < matchFieldAttributeValues.length; attrIndex++) {
    const attributeValue = matchFieldAttributeValues[attrIndex];
    if (!attributeValue) {
      continue;
    }

    // Separate camel case words and case them to lower case values
    const camelCaseSeparatedFieldAttribute = attributeValue
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase();
    // Split the attribute by non-alphabetical characters to get the keywords
    const attributeKeywords = camelCaseSeparatedFieldAttribute.split(/[^a-z]/gi);

    for (let keywordIndex = 0; keywordIndex < attributeKeywords.length; keywordIndex++) {
      if (searchFieldNamesSet.has(attributeKeywords[keywordIndex])) {
        return true;
      }
    }
  }

  return false;
}

export function isExcludedFieldType(field: AutofillField, excludedTypes: string[]) {
  if (forCustomFieldsOnly(field)) {
    return true;
  }

  if (field.type != null && isExcludedType(field.type, excludedTypes)) {
    return true;
  }

  // Check if the input is an untyped/mistyped search input
  return isSearchField(field);
}

export function valueIsLikePassword(value: string) {
  if (value == null) {
    return false;
  }
  // Removes all whitespace, _ and - characters
  const cleanedValue = value.toLowerCase().replace(/[\s_-]/g, "");

  if (cleanedValue.indexOf("password") < 0) {
    return false;
  }

  return !AutoFillConstants.PasswordFieldExcludeList.some((i) => cleanedValue.indexOf(i) > -1);
}

export function fieldHasDisqualifyingAttributeValue(field: AutofillField) {
  const checkedAttributeValues = [field.htmlID, field.htmlName, field.placeholder];
  let valueIsOnExclusionList = false;

  for (let i = 0; i < checkedAttributeValues.length; i++) {
    const checkedAttributeValue = checkedAttributeValues[i];
    const cleanedValue = checkedAttributeValue?.toLowerCase().replace(/[\s_-]/g, "");

    valueIsOnExclusionList = Boolean(
      cleanedValue && AutoFillConstants.FieldIgnoreList.some((i) => cleanedValue.indexOf(i) > -1),
    );

    if (valueIsOnExclusionList) {
      break;
    }
  }

  return valueIsOnExclusionList;
}

function collectExcludedPasswordFieldIds(pageDetails: AutofillPageDetails): Set<string> {
  const passwordFieldsByForm = new Map<string | null, AutofillField[]>();
  for (const field of pageDetails.fields) {
    if (field.type !== "password" || field.disabled) {
      continue;
    }
    const formKey = field.form ?? null;
    const fieldsForForm = passwordFieldsByForm.get(formKey);
    if (fieldsForForm) {
      fieldsForForm.push(field);
    } else {
      passwordFieldsByForm.set(formKey, [field]);
    }
  }

  const isCurrentPassword = (f: AutofillField) =>
    autoCompleteTypeIncludesToken(
      f.autoCompleteType,
      AutoFillConstants.AutocompleteCurrentPassword,
    );

  const excluded = new Set<string>();
  for (const [, passwordFields] of passwordFieldsByForm) {
    if (passwordFields.length >= 2 && passwordFields.some(isCurrentPassword)) {
      for (const field of passwordFields) {
        if (!isCurrentPassword(field)) {
          excluded.add(field.opid);
        }
      }
    }
  }
  return excluded;
}

/**
 * Accepts a pageDetails object with a list of fields and returns a list of
 * fields that are likely to be password fields.
 */
export function loadPasswordFields(
  pageDetails: AutofillPageDetails,
  canBeHidden: boolean,
  canBeReadOnly: boolean,
  mustBeEmpty: boolean,
  fillNewPassword: boolean,
  inlineMenuFillType?: InlineMenuFillType,
) {
  const arr: AutofillField[] = [];

  const excludedPasswordFieldOpids =
    fillNewPassword && inlineMenuFillType === InlineMenuFillTypes.PasswordGeneration
      ? new Set<string>()
      : collectExcludedPasswordFieldIds(pageDetails);

  pageDetails.fields.forEach((f) => {
    const isPassword = f.type === "password";
    if (!isPassword && isExcludedFieldType(f, AutoFillConstants.ExcludedAutofillLoginTypes)) {
      return;
    }

    // If any attribute values match disqualifying values, the entire field should not be used
    if (fieldHasDisqualifyingAttributeValue(f)) {
      return;
    }

    // We want to avoid treating TOTP fields as password fields
    if (fieldContainsKeyword(f, AutoFillConstants.TotpFieldNames)) {
      return;
    }

    const isLikePassword = () => {
      if (f.type !== "text") {
        return false;
      }

      const testedValues = [f.htmlID, f.htmlName, f.placeholder];
      for (let i = 0; i < testedValues.length; i++) {
        const value = testedValues[i];
        if (value != null && valueIsLikePassword(value)) {
          return true;
        }
      }

      return false;
    };

    if (
      !f.disabled &&
      (canBeReadOnly || !f.readonly) &&
      (isPassword || isLikePassword()) &&
      (canBeHidden || f.viewable) &&
      (!mustBeEmpty || f.value == null || f.value.trim() === "") &&
      (fillNewPassword ||
        !autoCompleteTypeIncludesToken(
          f.autoCompleteType,
          AutoFillConstants.AutocompleteNewPassword,
        )) &&
      !excludedPasswordFieldOpids.has(f.opid)
    ) {
      arr.push(f);
    }
  });

  return arr;
}

/** Determines if a password field is part of a registration/signup form. */
export function isRegistrationPasswordField(
  pageDetails: AutofillPageDetails,
  passwordField: AutofillField,
): boolean {
  if (!passwordField.form || !pageDetails.forms) {
    return false;
  }

  const form = pageDetails.forms[passwordField.form];
  if (!form) {
    return false;
  }

  const formIdentifierValues = [
    form.htmlID?.toLowerCase?.(),
    form.htmlName?.toLowerCase?.(),
    passwordField?.htmlID?.toLowerCase?.(),
    passwordField?.htmlName?.toLowerCase?.(),
  ].filter((value): value is string => typeof value === "string");

  return formIdentifierValues.some((value) =>
    AutoFillConstants.RegistrationKeywords.some((keyword) => value.includes(keyword)),
  );
}

export function findUsernameField(
  pageDetails: AutofillPageDetails,
  passwordField: AutofillField,
  canBeHidden: boolean,
  canBeReadOnly: boolean,
  withoutForm: boolean,
): AutofillField | null {
  let sameFormCandidate: AutofillField | null = null;
  let bestCandidate: AutofillField | null = null;

  const fieldsPrecedingPassword = pageDetails.fields.filter(
    (f) => f.elementNumber < passwordField.elementNumber,
  );

  for (const field of fieldsPrecedingPassword) {
    if (forCustomFieldsOnly(field)) {
      continue;
    }

    if (isNonLoginFormContext(field, pageDetails)) {
      continue;
    }

    const isUsernameFieldType =
      field.type === "text" || field.type === "email" || field.type === "tel";
    if (!isUsernameFieldType) {
      continue;
    }

    // Only consider fields with non-null form values as being in the same form;
    // null forms are treated as separate
    const isInSameForm =
      field.form != null && passwordField.form != null && field.form === passwordField.form;

    const includesUsernameKeyword = fieldContainsKeyword(
      field,
      AutoFillConstants.UsernameFieldNames,
    );

    // Email/tel fields in the same form are strong candidates even when visibility
    // checks are unreliable
    const isQualifiedByType = isInSameForm && (field.type === "email" || field.type === "tel");

    const isAccessible = !field.disabled && (canBeReadOnly || !field.readonly);
    const isVisible = canBeHidden || field.viewable || isQualifiedByType;
    const isReachable = withoutForm || isInSameForm || includesUsernameKeyword;

    if (!isAccessible || !isVisible || !isReachable) {
      continue;
    }

    if (isInSameForm) {
      sameFormCandidate = field;
      // A same-form field explicitly named for username is the best possible match
      if (includesUsernameKeyword) {
        return field;
      }
    } else {
      bestCandidate = field;
    }
  }

  // Prefer a same-form candidate, fall back to any matching field
  return sameFormCandidate || bestCandidate;
}

export function findTotpField(
  pageDetails: AutofillPageDetails,
  passwordField: AutofillField,
  canBeHidden: boolean,
  canBeReadOnly: boolean,
  withoutForm: boolean,
): AutofillField | null {
  let totpField: AutofillField | null = null;
  for (let i = 0; i < pageDetails.fields.length; i++) {
    const f = pageDetails.fields[i];
    if (forCustomFieldsOnly(f)) {
      continue;
    }

    const fieldIsDisqualified = fieldHasDisqualifyingAttributeValue(f);

    if (
      !fieldIsDisqualified &&
      !f.disabled &&
      (canBeReadOnly || !f.readonly) &&
      (withoutForm || f.form === passwordField.form) &&
      (canBeHidden || f.viewable) &&
      (f.type === "text" ||
        f.type === "number" ||
        // sites will commonly use tel in order to get the digit pad against semantic recommendations
        f.type === "tel") &&
      fieldContainsKeyword(f, [
        ...AutoFillConstants.TotpFieldNames,
        ...AutoFillConstants.AmbiguousTotpFieldNames,
      ]) &&
      !fieldContainsKeyword(f, [...AutoFillConstants.RecoveryCodeFieldNames])
    ) {
      totpField = f;

      if (
        findMatchingFieldIndex(f, [
          ...AutoFillConstants.TotpFieldNames,
          ...AutoFillConstants.AmbiguousTotpFieldNames,
        ]) > -1 ||
        f.autoCompleteType === "one-time-code"
      ) {
        // We found an exact match. No need to keep looking.
        break;
      }
    }
  }

  return totpField;
}

const matchableProperties = [
  "htmlID",
  "htmlName",
  "label-left",
  "label-right",
  "label-tag",
  "label-aria",
  "placeholder",
] as const;

const prefixForProperty: Record<(typeof matchableProperties)[number], string> = {
  htmlID: "id",
  htmlName: "name",
  "label-left": "label",
  "label-right": "label",
  "label-tag": "label",
  "label-aria": "label",
  placeholder: "placeholder",
};

/**
 * Accepts a field and returns the index of the first matching property
 * present in a list of attribute names.
 */
export function findMatchingFieldIndex(field: AutofillField, names: string[]): number {
  for (let i = 0; i < names.length; i++) {
    if (names[i].indexOf("=") > -1) {
      for (const property of matchableProperties) {
        if (fieldPropertyIsPrefixMatch(field, property, names[i], prefixForProperty[property])) {
          return i;
        }
      }
    }

    for (const property of matchableProperties) {
      if (fieldPropertyIsMatch(field, property, names[i])) {
        return i;
      }
    }
  }

  return -1;
}

function fieldPropertyIsPrefixMatch(
  field: any,
  property: string,
  name: string,
  prefix: string,
  separator = "=",
): boolean {
  if (name.indexOf(prefix + separator) === 0) {
    const sepIndex = name.indexOf(separator);
    const val = name.substring(sepIndex + 1);
    return val != null && fieldPropertyIsMatch(field, property, val);
  }
  return false;
}

/**
 * Identifies if a given property within a field matches the value of the passed "name"
 * parameter. A "regex=" name is tested as a case-insensitive regular expression and a "csv="
 * name is treated as a comma-separated list of values.
 */
export function fieldPropertyIsMatch(
  field: any,
  property: string,
  name: string,
  onError?: (error: unknown) => void,
): boolean {
  let fieldVal = field[property] as string;
  if (!hasValue(fieldVal)) {
    return false;
  }

  fieldVal = fieldVal.trim().replace(/(?:\r\n|\r|\n)/g, "");
  if (name.startsWith("regex=")) {
    try {
      const regexParts = name.split("=", 2);
      if (regexParts.length === 2) {
        const regex = new RegExp(regexParts[1], "i");
        return regex.test(fieldVal);
      }
    } catch (e) {
      onError?.(e);
    }
  } else if (name.startsWith("csv=")) {
    const csvParts = name.split("=", 2);
    if (csvParts.length === 2) {
      const csvVals = csvParts[1].split(",");
      for (let i = 0; i < csvVals.length; i++) {
        const val = csvVals[i];
        if (val != null && val.trim().toLowerCase() === fieldVal.toLowerCase()) {
          return true;
        }
      }
      return false;
    }
  }

  return fieldVal.toLowerCase() === name;
}

const defaultHelpers: LoginFillHelpers = {
  findUsernameField,
  findTotpField,
  isRegistrationPasswordField,
};

/**
 * First phase of login fill script generation. Fills username and password targets and collects
 * TOTP targets so the caller can supply a code (possibly asynchronously) to
 * {@link completeLoginFillScript}.
 */
export function planLoginFillScript(
  fillScript: AutofillScript,
  pageDetails: AutofillPageDetails,
  filledFields: { [id: string]: AutofillField },
  login: LoginFillCredential,
  options: LoginFillOptions,
  helpers: LoginFillHelpers = defaultHelpers,
): LoginFillPlan {
  const passwords: AutofillField[] = [];
  const usernames = new Map<string, AutofillField>();
  const totps: AutofillField[] = [];
  let pf: AutofillField | null = null;
  let username: AutofillField | null = null;
  let totp: AutofillField | null = null;

  const passwordFields = loadPasswordFields(
    pageDetails,
    false,
    false,
    options.onlyEmptyFields,
    options.fillNewPassword,
    options.inlineMenuFillType,
  );

  const loginPasswordFields: AutofillField[] = [];
  const registrationPasswordFields: AutofillField[] = [];

  passwordFields.forEach((passField) => {
    if (helpers.isRegistrationPasswordField(pageDetails, passField)) {
      registrationPasswordFields.push(passField);
    } else {
      loginPasswordFields.push(passField);
    }
  });

  // Prefer login fields over registration fields
  const prioritizedPasswordFields =
    loginPasswordFields.length > 0 ? loginPasswordFields : registrationPasswordFields;

  const focusedField = options.focusedFieldOpid
    ? pageDetails.fields.find((f) => f.opid === options.focusedFieldOpid)
    : undefined;
  const focusedForm = focusedField?.form;

  const isFocusedTotpField =
    focusedField &&
    options.allowTotpAutofill &&
    (focusedField.type === "text" ||
      focusedField.type === "number" ||
      focusedField.type === "tel") &&
    (fieldContainsKeyword(focusedField, [
      ...AutoFillConstants.TotpFieldNames,
      ...AutoFillConstants.AmbiguousTotpFieldNames,
    ]) ||
      focusedField.autoCompleteType === "one-time-code") &&
    !fieldContainsKeyword(focusedField, [...AutoFillConstants.RecoveryCodeFieldNames]);

  const focusedUsernameField =
    focusedField &&
    !isFocusedTotpField &&
    login.username &&
    (focusedField.type === "text" ||
      focusedField.type === "email" ||
      focusedField.type === "tel") &&
    focusedField;

  const passwordMatchesFocused = (pf: AutofillField): boolean =>
    !focusedField
      ? true
      : focusedForm != null
        ? pf.form === focusedForm
        : !!(
            focusedUsernameField &&
            pf.form == null &&
            helpers.findUsernameField(pageDetails, pf, false, false, true)?.opid ===
              focusedUsernameField.opid
          );

  const getUsernameForPassword = (
    pf: AutofillField,
    withoutForm: boolean,
  ): AutofillField | null => {
    // use focused username if it matches this password, otherwise fall back to finding username field before password
    if (focusedUsernameField && passwordMatchesFocused(pf)) {
      return focusedUsernameField;
    }
    return helpers.findUsernameField(pageDetails, pf, false, false, withoutForm);
  };

  if (
    focusedUsernameField &&
    focusedUsernameField.opid != null &&
    !prioritizedPasswordFields.some(passwordMatchesFocused)
  ) {
    if (!Object.prototype.hasOwnProperty.call(filledFields, focusedUsernameField.opid)) {
      filledFields[focusedUsernameField.opid] = focusedUsernameField;
      const usernameVal = login.username;
      if (usernameVal != null) {
        fillByOpid(fillScript, focusedUsernameField, usernameVal);
      }
      if (options.autoSubmitLogin && focusedUsernameField.form) {
        fillScript.autosubmit = [focusedUsernameField.form];
      }
      return {
        fillScript: setFillScriptForFocus(
          { [focusedUsernameField.opid]: focusedUsernameField },
          fillScript,
        ),
        filledFields,
        totps,
        final: true,
      };
    }
  }

  const pageHasNoFormMetadata =
    pageDetails.forms == null || Object.keys(pageDetails.forms).length === 0;

  prioritizedPasswordFields.forEach((passField) => {
    if (focusedField && !passwordMatchesFocused(passField)) {
      return;
    }

    pf = passField;
    passwords.push(pf);

    if (login.username) {
      username = getUsernameForPassword(pf, pageHasNoFormMetadata);
      if (username?.opid != null) {
        usernames.set(username.opid, username);
      }
    }

    if (options.allowTotpAutofill && login.totp) {
      totp =
        isFocusedTotpField && passwordMatchesFocused(passField)
          ? focusedField
          : helpers.findTotpField(pageDetails, pf, false, false, pageHasNoFormMetadata);
      if (totp) {
        totps.push(totp);
      }
    }
  });

  if (passwordFields.length && !passwords.length) {
    // in the event that password fields exist but weren't processed within form elements.
    const isPasswordGeneration =
      options.inlineMenuFillType === InlineMenuFillTypes.PasswordGeneration;
    const isCurrentPasswordUpdate =
      options.inlineMenuFillType === InlineMenuFillTypes.CurrentPasswordUpdate;

    // For password generation or current password update, include all password fields from the same form
    // This ensures we have access to all fields regardless of their login/registration classification
    if ((isPasswordGeneration || isCurrentPasswordUpdate) && focusedField) {
      // Add all password fields from the same form as the focused field
      const focusedFieldForm = focusedField.form;

      // Check both login and registration fields to ensure we get all password fields
      const allPasswordFields = [...loginPasswordFields, ...registrationPasswordFields];
      allPasswordFields.forEach((passField) => {
        if (passField.form === focusedFieldForm) {
          passwords.push(passField);
        }
      });
    }

    // If we didn't add any passwords above (either not password generation/update or no matching fields),
    // select matching password if focused, otherwise first in prioritized list.
    if (!passwords.length) {
      const passwordFieldToUse = focusedField
        ? prioritizedPasswordFields.find(passwordMatchesFocused) || prioritizedPasswordFields[0]
        : prioritizedPasswordFields[0];

      if (passwordFieldToUse) {
        passwords.push(passwordFieldToUse);
      }
    }

    // Handle username and TOTP for the first password field
    const firstPasswordField = passwords[0];
    if (firstPasswordField) {
      if (login.username && firstPasswordField.elementNumber > 0) {
        username = getUsernameForPassword(firstPasswordField, true);
        if (username?.opid != null) {
          usernames.set(username.opid, username);
        }
      }

      if (options.allowTotpAutofill && login.totp && firstPasswordField.elementNumber > 0) {
        totp =
          isFocusedTotpField && passwordMatchesFocused(firstPasswordField)
            ? focusedField
            : helpers.findTotpField(pageDetails, firstPasswordField, false, false, true);
        if (totp) {
          totps.push(totp);
        }
      }
    }
  }

  if (!passwordFields.length) {
    // If there are no passwords, username or TOTP fields may be present.
    // username and TOTP fields are mutually exclusive
    pageDetails.fields.forEach((field) => {
      if (!field.viewable) {
        return;
      }

      const isTotpCandidate =
        options.allowTotpAutofill &&
        ["number", "tel", "text"].some((t) => t === field.type) &&
        !fieldContainsKeyword(field, [...AutoFillConstants.RecoveryCodeFieldNames]);

      const isTotpField =
        isTotpCandidate &&
        (fieldContainsKeyword(field, AutoFillConstants.TotpFieldNames) ||
          field.autoCompleteType === "one-time-code");

      const maybeTotpField =
        isTotpCandidate && fieldContainsKeyword(field, AutoFillConstants.AmbiguousTotpFieldNames);

      const isUsernameField =
        !options.skipUsernameOnlyFill &&
        ["email", "tel", "text"].some((t) => t === field.type) &&
        fieldContainsKeyword(field, AutoFillConstants.UsernameFieldNames) &&
        !isNonLoginFormContext(field, pageDetails);

      // Reliable TOTP signals win unconditionally; username wins over ambiguous TOTP signals.
      switch (true) {
        case isTotpField:
          totps.push(field);
          return;
        case isUsernameField:
          usernames.set(field.opid, field);
          return;
        case maybeTotpField:
          totps.push(field);
          return;
        default:
          return;
      }
    });
  }

  const formElementsSet = new Set<string>();
  const usernamesToFill = focusedUsernameField ? [focusedUsernameField] : [...usernames.values()];

  usernamesToFill.forEach((u) => {
    if (u.opid == null) {
      return;
    }
    const uOpid = u.opid;
    if (Object.prototype.hasOwnProperty.call(filledFields, uOpid)) {
      return;
    }

    filledFields[uOpid] = u;
    const usernameVal = login.username;
    if (usernameVal != null) {
      fillByOpid(fillScript, u, usernameVal);
    }
    if (u.form != null) {
      formElementsSet.add(u.form);
    }
  });

  passwords.forEach((p) => {
    if (p.opid == null) {
      return;
    }
    const pOpid = p.opid;
    if (Object.prototype.hasOwnProperty.call(filledFields, pOpid)) {
      return;
    }

    filledFields[pOpid] = p;
    if (login.password != null) {
      fillByOpid(fillScript, p, login.password);
    }
    if (p.form != null) {
      formElementsSet.add(p.form);
    }
  });

  if (options.autoSubmitLogin && formElementsSet.size) {
    fillScript.autosubmit = Array.from(formElementsSet);
  }

  return { fillScript, filledFields, totps, final: false };
}

/** True when {@link completeLoginFillScript} would use a TOTP code. */
export function loginFillPlanNeedsTotp(
  plan: LoginFillPlan,
  login: LoginFillCredential,
  options: LoginFillOptions,
): boolean {
  return (
    !plan.final &&
    options.allowTotpAutofill &&
    typeof login.totp === "string" &&
    plan.totps.some(
      (t) => t.opid != null && !Object.prototype.hasOwnProperty.call(plan.filledFields, t.opid),
    )
  );
}

/** Second phase: places the TOTP code, when one applies, and sets the final focus action. */
export function completeLoginFillScript(
  plan: LoginFillPlan,
  totpCode?: string | null,
): AutofillScript {
  if (plan.final) {
    return plan.fillScript;
  }

  const { fillScript, filledFields, totps } = plan;
  totps.forEach((t, i) => {
    if (t.opid == null) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(filledFields, t.opid)) {
      return;
    }

    filledFields[t.opid] = t;

    if (totpCode == null) {
      return;
    }
    const totpChar = totpCode.length === totps.length ? totpCode.charAt(i) : totpCode;
    fillByOpid(fillScript, t, totpChar);
  });

  return setFillScriptForFocus(filledFields, fillScript);
}

/**
 * Synchronous login fill script generation for callers that already hold a TOTP code
 * (or none) and have no vault. The credential is treated as plain data.
 */
export function generateLoginFillScript(
  pageDetails: AutofillPageDetails,
  login: LoginFillCredential,
  options: LoginFillOptions,
  helpers?: LoginFillHelpers,
): AutofillScript {
  const fillScript = new AutofillScript();
  fillScript.savedUrls = [];
  fillScript.untrustedIframe = false;
  const plan = planLoginFillScript(fillScript, pageDetails, {}, login, options, helpers);
  return completeLoginFillScript(plan, login.totp);
}
