export const CardExpiryDateDelimiters: string[] = ["/", "-", ".", " "];

// `CardExpiryDateDelimiters` is not intended solely for regex consumption,
// so we need to format it here
export const ExpiryDateDelimitersPattern =
  "\\" +
  CardExpiryDateDelimiters.join("\\")
    // replace space character with the regex whitespace character class
    .replace(" ", "s");

export const MonthPattern = "(([1]{1}[0-2]{1})|(0?[1-9]{1}))";

// Because we're dealing with expiry dates, we assume the year will be in current or next century (as of 2024)
export const ExpiryFullYearPattern = "2[0-1]{1}\\d{2}";

export const DelimiterPatternExpression = new RegExp(`[${ExpiryDateDelimitersPattern}]`, "g");

export const IrrelevantExpiryCharactersPatternExpression = new RegExp(
  // "nor digits" to ensure numbers are removed from guidance pattern, which aren't covered by ^\w
  `[^\\d${ExpiryDateDelimitersPattern}]`,
  "g",
);

export const MonthPatternExpression = new RegExp(`^${MonthPattern}$`);

export const ExpiryFullYearPatternExpression = new RegExp(`^${ExpiryFullYearPattern}$`);
