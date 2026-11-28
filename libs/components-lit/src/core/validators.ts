import { t } from "./i18n";

export type ValidationErrors = Record<string, unknown>;

/** Returns `null` when valid. `normalize` lets a validator rewrite the value first (see `trim`). */
export type Validator<V = unknown> = ((value: V) => ValidationErrors | null) & {
  normalize?: (value: V) => V;
};

const isEmpty = (value: unknown) =>
  value == null || value === "" || (Array.isArray(value) && value.length === 0);

const EMAIL =
  /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const trim: Validator<string> = Object.assign(
  (value: string) => {
    if (isEmpty(value)) {
      return null;
    }
    return String(value).trim().length ? null : { trim: { message: "input is only whitespace" } };
  },
  { normalize: (value: string) => (typeof value === "string" ? value.trim() : value) },
);

/** Framework-neutral equivalents of Angular's `Validators` plus the Bitwarden validators. */
export const Validators = {
  required: ((value: unknown) => (isEmpty(value) ? { required: true } : null)) as Validator,
  email: ((value: string) =>
    isEmpty(value) || EMAIL.test(value) ? null : { email: true }) as Validator,
  minLength:
    (requiredLength: number): Validator =>
    (value) =>
      !isEmpty(value) && (value as string | unknown[]).length < requiredLength
        ? { minlength: { requiredLength, actualLength: (value as string).length } }
        : null,
  maxLength:
    (requiredLength: number): Validator =>
    (value) =>
      !isEmpty(value) && (value as string | unknown[]).length > requiredLength
        ? { maxlength: { requiredLength, actualLength: (value as string).length } }
        : null,
  min:
    (min: number): Validator =>
    (value) =>
      !isEmpty(value) && Number(value) < min ? { min: { min, actual: value } } : null,
  max:
    (max: number): Validator =>
    (value) =>
      !isEmpty(value) && Number(value) > max ? { max: { max, actual: value } } : null,
  pattern:
    (pattern: RegExp): Validator =>
    (value) =>
      !isEmpty(value) && !pattern.test(String(value))
        ? { pattern: { requiredPattern: String(pattern) } }
        : null,
  /** Errors if the value contains any of `characters`. */
  forbiddenCharacters:
    (characters: string[]): Validator =>
    (value) => {
      if (value == null) {
        return null;
      }
      return [...String(value)].some((char) => characters.includes(char))
        ? { forbiddenCharacters: { value, characters } }
        : null;
    },
  /** Trims the value; errors if it's only whitespace. */
  trim: trim as Validator,
  /** Comma-separated list of emails. */
  multipleEmails: ((value: string) => {
    if (isEmpty(value)) {
      return null;
    }
    const invalid = String(value)
      .split(",")
      .map((email) => email.trim())
      .some((email) => !EMAIL.test(email));
    return invalid ? { multipleEmails: true } : null;
  }) as Validator,
};

/** Localized message for the first error, matching `bit-error`'s wording. */
export function errorMessage(errors: ValidationErrors | null): string {
  if (!errors) {
    return "";
  }
  const [key, data] = Object.entries(errors)[0] as [string, any];
  switch (key) {
    case "required":
      return t("inputRequired");
    case "email":
      return t("inputEmail");
    case "minlength":
      return t("inputMinLength", data?.requiredLength);
    case "maxlength":
      return t("inputMaxLength", data?.requiredLength);
    case "min":
      return t("inputMinValue", data?.min);
    case "max":
      return t("inputMaxValue", data?.max);
    case "forbiddenCharacters":
      return t("inputForbiddenCharacters", data?.characters.join(", "));
    case "multipleEmails":
      return t("multipleInputEmails");
    case "trim":
      return t("inputTrimValidator");
    default:
      return data?.message ?? key;
  }
}
