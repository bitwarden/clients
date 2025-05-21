import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { CardView } from "../vault/models/view/card.view";

import {
  DelimiterPatternExpression,
  ExpiryFullYearPattern,
  ExpiryFullYearPatternExpression,
  IrrelevantExpiryCharactersPatternExpression,
  MonthPatternExpression,
} from "./constants";

type NonZeroIntegers = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Year = `${NonZeroIntegers}${NonZeroIntegers}${0 | NonZeroIntegers}${0 | NonZeroIntegers}`;

/**
 * Takes a string or number value and returns a string value formatted as a valid 4-digit year
 *
 * @param {(string | number)} yearInput
 * @return {*}  {(Year | null)}
 */
export function normalizeExpiryYearFormat(yearInput: string | number): Year | null {
  // The input[type="number"] is returning a number, convert it to a string
  // An empty field returns null, avoid casting `"null"` to a string
  const yearInputIsEmpty = yearInput == null || yearInput === "";
  let expirationYear = yearInputIsEmpty ? null : `${yearInput}`;

  // Exit early if year is already formatted correctly or empty
  if (yearInputIsEmpty || (expirationYear && /^[1-9]{1}\d{3}$/.test(expirationYear))) {
    return expirationYear as Year;
  }

  expirationYear = (expirationYear || "")
    // For safety, because even input[type="number"] will allow decimals
    .replace(/[^\d]/g, "")
    // remove any leading zero padding (leave the last leading zero if it ends the string)
    .replace(/^[0]+(?=.)/, "");

  if (expirationYear === "") {
    expirationYear = null;
  }

  // given the context of payment card expiry, a year character length of 3, or over 4
  // is more likely to be a mistake than an intentional value for the far past or far future.
  if (expirationYear && expirationYear.length !== 4) {
    const paddedYear = ("00" + expirationYear).slice(-2);
    const currentCentury = `${new Date().getFullYear()}`.slice(0, 2);

    expirationYear = currentCentury + paddedYear;
  }

  return expirationYear as Year | null;
}

/**
 * Takes a cipher card view and returns "true" if the month and year affirmativey indicate
 * the card is expired. Uncertain cases return "false".
 *
 * @param {CardView} cipherCard
 * @return {*}  {boolean}
 */
export function isCardExpired(cipherCard: CardView): boolean {
  if (cipherCard) {
    const { expMonth = null, expYear = null } = cipherCard;

    if (!expYear) {
      return false;
    }

    const now = new Date();
    const normalizedYear = normalizeExpiryYearFormat(expYear);
    const parsedYear = normalizedYear ? parseInt(normalizedYear, 10) : NaN;

    const expiryYearIsBeforeCurrentYear = parsedYear < now.getFullYear();
    const expiryYearIsAfterCurrentYear = parsedYear > now.getFullYear();

    // If the expiry year is before the current year, skip checking the month, since it must be expired
    if (normalizedYear && expiryYearIsBeforeCurrentYear) {
      return true;
    }

    // If the expiry year is after the current year, skip checking the month, since it cannot be expired
    if (normalizedYear && expiryYearIsAfterCurrentYear) {
      return false;
    }

    if (normalizedYear && expMonth) {
      const parsedMonthInteger = parseInt(expMonth, 10);
      const parsedMonthIsValid = parsedMonthInteger && !isNaN(parsedMonthInteger);

      // If the parsed month value is 0, we don't know when the expiry passes this year, so do not treat it as expired
      if (!parsedMonthIsValid) {
        return false;
      }

      // `Date` months are zero-indexed
      const parsedMonth = parsedMonthInteger - 1;

      // First day of the next month
      const cardExpiry = new Date(parsedYear, parsedMonth + 1, 1);

      return cardExpiry <= now;
    }
  }

  return false;
}

/**
 * Attempt to split a string into date segments on the basis of expected formats and delimiter symbols.
 *
 * @param {string} combinedExpiryValue
 * @return {*}  {string[]}
 */
function splitCombinedDateValues(combinedExpiryValue: string): string[] {
  let sanitizedValue = combinedExpiryValue
    .replace(IrrelevantExpiryCharactersPatternExpression, "")
    .trim();

  // Do this after initial value replace to avoid identifying leading whitespace as delimiter
  const parsedDelimiter = sanitizedValue.match(DelimiterPatternExpression)?.[0] || null;

  let dateParts = [sanitizedValue];

  if (parsedDelimiter?.length) {
    // If the parsed delimiter is a whitespace character, assign 's' (character class) instead
    const delimiterPattern = /\s/.test(parsedDelimiter) ? "\\s" : "\\" + parsedDelimiter;

    sanitizedValue = sanitizedValue
      // Remove all other delimiter characters not identified as the delimiter
      .replace(new RegExp(`[^\\d${delimiterPattern}]`, "g"), "")
      // Also de-dupe the delimiter character
      .replace(new RegExp(`[${delimiterPattern}]{2,}`, "g"), parsedDelimiter);

    dateParts = sanitizedValue.split(parsedDelimiter);
  }

  return (
    dateParts
      // remove values that have no length
      .filter((splitValue) => splitValue?.length)
  );
}

/**
 * Given an array of split card expiry date parts,
 * returns an array of those values ordered by year then month
 *
 * @param {string[]} splitDateInput
 * @return {*}  {([string | null, string | null])}
 */
function parseDelimitedYearMonthExpiry([firstPart, secondPart]: string[]): [string, string] {
  // Conditionals here are structured to avoid unnecessary evaluations and are ordered
  // from more authoritative checks to checks yielding increasingly inferred conclusions

  // If a 4-digit value is found (when there are multiple parts), it can't be month
  if (ExpiryFullYearPatternExpression.test(firstPart)) {
    return [firstPart, secondPart];
  }

  // If a 4-digit value is found (when there are multiple parts), it can't be month
  if (ExpiryFullYearPatternExpression.test(secondPart)) {
    return [secondPart, firstPart];
  }

  // If it's a two digit value that doesn't match against month pattern, assume it's a year
  if (/\d{2}/.test(firstPart) && !MonthPatternExpression.test(firstPart)) {
    return [firstPart, secondPart];
  }

  // If it's a two digit value that doesn't match against month pattern, assume it's a year
  if (/\d{2}/.test(secondPart) && !MonthPatternExpression.test(secondPart)) {
    return [secondPart, firstPart];
  }

  // Values are too ambiguous (e.g. "12/09"). For the most part,
  // a month-looking value likely is, at the time of writing (year 2024).
  let parsedYear = firstPart;
  let parsedMonth = secondPart;

  if (MonthPatternExpression.test(firstPart)) {
    parsedYear = secondPart;
    parsedMonth = firstPart;
  }

  return [parsedYear, parsedMonth];
}

/**
 * Given a single string of integers, attempts to identify card expiry date portions within
 * and return values ordered by year then month
 *
 * @param {string} dateInput
 * @return {*}  {([string | null, string | null])}
 */
function parseNonDelimitedYearMonthExpiry(dateInput: string): [string | null, string | null] {
  if (dateInput.length > 4) {
    // e.g.
    // "052024"
    // "202405"
    // "20245"
    // "52024"

    // If the value is over 5-characters long, it likely has a full year format in it
    const [parsedYear, parsedMonth] = dateInput
      .split(new RegExp(`(?=${ExpiryFullYearPattern})|(?<=${ExpiryFullYearPattern})`, "g"))
      .sort((current: string, next: string) => (current.length > next.length ? -1 : 1));

    return [parsedYear, parsedMonth];
  }

  if (dateInput.length === 4) {
    // e.g.
    // "0524"
    // "2405"

    // If the `sanitizedFirstPart` value is a length of 4, it must be split in half, since
    // neither a year or month will be represented with three characters
    const splitFirstPartFirstHalf = dateInput.slice(0, 2);
    const splitFirstPartSecondHalf = dateInput.slice(-2);

    let parsedYear = splitFirstPartSecondHalf;
    let parsedMonth = splitFirstPartFirstHalf;

    // If the first part doesn't match a month pattern, assume it's a year
    if (!MonthPatternExpression.test(splitFirstPartFirstHalf)) {
      parsedYear = splitFirstPartFirstHalf;
      parsedMonth = splitFirstPartSecondHalf;
    }

    return [parsedYear, parsedMonth];
  }

  // e.g.
  // "245"
  // "202"
  // "212"
  // "022"
  // "111"

  // A valid year representation here must be two characters so try to find it first.

  let parsedYear = null;
  let parsedMonth = null;

  // Split if there is a digit with a leading zero
  const splitFirstPartOnLeadingZero = dateInput.split(/(?<=0[1-9]{1})|(?=0[1-9]{1})/);

  // Assume a leading zero indicates a month in ambiguous cases (e.g. "202"), since we're
  // dealing with expiry dates and the next two-digit year with a leading zero will be 2100
  if (splitFirstPartOnLeadingZero.length > 1) {
    parsedYear = splitFirstPartOnLeadingZero[0];
    parsedMonth = splitFirstPartOnLeadingZero[1];

    if (splitFirstPartOnLeadingZero[0].startsWith("0")) {
      parsedMonth = splitFirstPartOnLeadingZero[0];
      parsedYear = splitFirstPartOnLeadingZero[1];
    }
  } else {
    // Here, a year has to be two-digits, and a month can't be more than one, so assume the first two digits that are greater than the current year is the year representation.
    parsedYear = dateInput.slice(0, 2);
    parsedMonth = dateInput.slice(-1);

    const currentYear = new Date().getFullYear();
    const normalizedYearFormat = normalizeExpiryYearFormat(parsedYear);
    const normalizedParsedYear = normalizedYearFormat && parseInt(normalizedYearFormat, 10);
    const normalizedExpiryYearFormat = normalizeExpiryYearFormat(dateInput.slice(-2));
    const normalizedParsedYearAlternative =
      normalizedExpiryYearFormat && parseInt(normalizedExpiryYearFormat, 10);

    if (
      normalizedParsedYear &&
      normalizedParsedYear < currentYear &&
      normalizedParsedYearAlternative &&
      normalizedParsedYearAlternative >= currentYear
    ) {
      parsedYear = dateInput.slice(-2);
      parsedMonth = dateInput.slice(0, 1);
    }
  }

  return [parsedYear, parsedMonth];
}

/**
 * Attempt to parse year and month parts of a combined expiry date value.
 *
 * @param {string} combinedExpiryValue
 * @return {*}  {([string | null, string | null])}
 */
export function parseYearMonthExpiry(combinedExpiryValue: string): [Year | null, string | null] {
  let parsedYear = null;
  let parsedMonth = null;

  const dateParts = splitCombinedDateValues(combinedExpiryValue);

  if (dateParts.length < 1) {
    return [null, null];
  }

  const sanitizedFirstPart =
    dateParts[0]?.replace(IrrelevantExpiryCharactersPatternExpression, "") || "";
  const sanitizedSecondPart =
    dateParts[1]?.replace(IrrelevantExpiryCharactersPatternExpression, "") || "";

  // If there is only one date part, no delimiter was found in the passed value
  if (dateParts.length === 1) {
    const [parsedNonDelimitedYear, parsedNonDelimitedMonth] =
      parseNonDelimitedYearMonthExpiry(sanitizedFirstPart);

    parsedYear = parsedNonDelimitedYear;
    parsedMonth = parsedNonDelimitedMonth;
  }
  // There are multiple date parts
  else {
    const [parsedDelimitedYear, parsedDelimitedMonth] = parseDelimitedYearMonthExpiry([
      sanitizedFirstPart,
      sanitizedSecondPart,
    ]);

    parsedYear = parsedDelimitedYear;
    parsedMonth = parsedDelimitedMonth;
  }

  const normalizedParsedYear = parsedYear ? normalizeExpiryYearFormat(parsedYear) : null;
  const normalizedParsedMonth = parsedMonth?.replace(/^0+/, "").slice(0, 2);

  // Set "empty" values to null
  parsedYear = normalizedParsedYear?.length ? normalizedParsedYear : null;
  parsedMonth = normalizedParsedMonth?.length ? normalizedParsedMonth : null;

  return [parsedYear, parsedMonth];
}

/**
 * Takes a URL string and a NeverDomains object and determines if the passed URL's hostname is in `urlList`
 *
 * @param {string} url - representation of URL to check
 * @param {NeverDomains} urlList - object with hostname key names
 */
export function isUrlInList(url: string = "", urlList: NeverDomains = {}): boolean {
  const urlListKeys = urlList && Object.keys(urlList);

  if (urlListKeys.length && url?.length) {
    let tabHostname;
    try {
      tabHostname = Utils.getHostname(url);
    } catch {
      // If the input was invalid, exit early and return false
      return false;
    }

    if (tabHostname) {
      return urlListKeys.some((blockedHostname) => tabHostname.endsWith(blockedHostname));
    }
  }

  return false;
}
