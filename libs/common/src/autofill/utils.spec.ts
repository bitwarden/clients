import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";

import { CardView } from "../vault/models/view/card.view";

import {
  isCardExpired,
  isUrlInList,
  normalizeExpiryYearFormat,
  parseYearMonthExpiry,
} from "./utils";

function getExpiryYearValueFormats(currentCentury: string) {
  return [
    [-12, `${currentCentury}12`],
    [0, `${currentCentury}00`],
    [2043, "2043"], // valid year with a length of four should be taken directly
    [24, `${currentCentury}24`],
    [3054, "3054"], // valid year with a length of four should be taken directly
    [31423524543, `${currentCentury}43`],
    [4, `${currentCentury}04`],
    [null, null],
    [undefined, null],
    ["-12", `${currentCentury}12`],
    ["", null],
    ["0", `${currentCentury}00`],
    ["00", `${currentCentury}00`],
    ["000", `${currentCentury}00`],
    ["0000", `${currentCentury}00`],
    ["00000", `${currentCentury}00`],
    ["0234234", `${currentCentury}34`],
    ["04", `${currentCentury}04`],
    ["2043", "2043"], // valid year with a length of four should be taken directly
    ["24", `${currentCentury}24`],
    ["3054", "3054"], // valid year with a length of four should be taken directly
    ["31423524543", `${currentCentury}43`],
    ["4", `${currentCentury}04`],
    ["aaaa", null],
    ["adgshsfhjsdrtyhsrth", null],
    ["agdredg42grg35grrr. ea3534@#^145345ag$%^  -_#$rdg ", `${currentCentury}45`],
  ];
}

describe("normalizeExpiryYearFormat", () => {
  const currentCentury = `${new Date().getFullYear()}`.slice(0, 2);

  const expiryYearValueFormats = getExpiryYearValueFormats(currentCentury);

  expiryYearValueFormats.forEach(([inputValue, expectedValue]) => {
    it(`should return '${expectedValue}' when '${inputValue}' is passed`, () => {
      const formattedValue = normalizeExpiryYearFormat(inputValue);

      expect(formattedValue).toEqual(expectedValue);
    });
  });

  describe("in the year 3107", () => {
    const theDistantFuture = new Date(Date.UTC(3107, 1, 1));
    jest.spyOn(Date, "now").mockReturnValue(theDistantFuture.valueOf());

    beforeAll(() => {
      jest.useFakeTimers({ advanceTimers: true });
      jest.setSystemTime(theDistantFuture);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    const currentCentury = `${new Date(Date.now()).getFullYear()}`.slice(0, 2);
    expect(currentCentury).toBe("31");

    const expiryYearValueFormats = getExpiryYearValueFormats(currentCentury);

    expiryYearValueFormats.forEach(([inputValue, expectedValue]) => {
      it(`should return '${expectedValue}' when '${inputValue}' is passed`, () => {
        const formattedValue = normalizeExpiryYearFormat(inputValue);

        expect(formattedValue).toEqual(expectedValue);
      });
    });
    jest.clearAllTimers();
  });
});

function getCardExpiryDateValues() {
  const currentDate = new Date();

  const currentYear = currentDate.getFullYear();

  // `Date` months are zero-indexed, our expiry date month inputs are one-indexed
  const currentMonth = currentDate.getMonth() + 1;

  const currentDateLastMonth = new Date(currentDate.setMonth(-1));

  return [
    [null, null, false], // no month, no year
    [undefined, undefined, false], // no month, no year, invalid values
    ["", "", false], // no month, no year, invalid values
    ["12", "agdredg42grg35grrr. ea3534@#^145345ag$%^  -_#$rdg ", false], // invalid values
    ["0", `${currentYear}`, false], // invalid month
    ["0", `${currentYear - 1}`, true], // invalid 0 month
    ["00", `${currentYear + 1}`, false], // invalid 0 month
    [`${currentMonth}`, "0000", true], // current month, in the year 2000
    [null, `${currentYear}`.slice(-2), false], // no month, this year
    [null, `${currentYear - 1}`.slice(-2), true], // no month, last year
    ["1", null, false], // no year, January
    ["1", `${currentYear - 1}`, true], // January last year
    ["13", `${currentYear}`, false], // 12 + 1 is Feb. in the next year (Date is zero-indexed)
    [`${currentMonth + 36}`, `${currentYear - 1}`, true], // even though the month value would put the date 3 years into the future when calculated with `Date`, an explicit year in the past indicates the card is expired
    [`${currentMonth}`, `${currentYear}`, false], // this year, this month (not expired until the month is over)
    [`${currentMonth}`, `${currentYear}`.slice(-2), false], // This month, this year (not expired until the month is over)
    [`${currentDateLastMonth.getMonth() + 1}`, `${currentDateLastMonth.getFullYear()}`, true], // last month
    [`${currentMonth - 1}`, `${currentYear + 1}`, false], // 11 months from now
  ];
}

describe("isCardExpired", () => {
  const expiryYearValueFormats = getCardExpiryDateValues();

  expiryYearValueFormats.forEach(
    ([inputMonth, inputYear, expectedValue]: [string | null, string | null, boolean]) => {
      it(`should return ${expectedValue} when the card expiry month is ${inputMonth} and the card expiry year is ${inputYear}`, () => {
        const testCardView = new CardView();
        testCardView.expMonth = inputMonth;
        testCardView.expYear = inputYear;

        const cardIsExpired = isCardExpired(testCardView);

        expect(cardIsExpired).toBe(expectedValue);
      });
    },
  );
});

const combinedDateTestValues = [
  " 2024 / 05 ",
  "05 2024",
  "05	2024", // Tab whitespace character
  "05 2024", // Em Quad
  "05 2024", // Em Space
  "05 2024", // En Quad
  "05 2024", // En Space
  "05 2024", // Figure Space
  "05 2024", // Four-Per-Em Space
  "05 2024", // Hair Space
  "05　2024", // Ideographic Space
  "05 2024", // Medium Mathematical Space
  "05 2024", // No-Break Space
  "05 2024", // ogham space mark
  "05 2024", // Punctuation Space
  "05 2024", // Six-Per-Em Space
  "05 2024", // Thin Space
  "05 2024", // Three-Per-Em Space
  "05 24",
  "05-2024",
  "05-24",
  "05.2024",
  "05.24",
  "05/2024",
  "05/24",
  "052024",
  "0524",
  "2024 05",
  "2024 5",
  "2024-05",
  "2024-5",
  "2024.05",
  "2024.5",
  "2024/05",
  "2024/5",
  "202405",
  "20245",
  "24 05",
  "24 5",
  "24-05",
  "24-5",
  "24.05",
  "24.5",
  "24/05",
  "24/5",
  "2405",
  "5 2024",
  "5 24",
  "5-2024",
  "5-24",
  "5.2024",
  "5.24",
  "5/2024",
  "5/24",
  "52024",
];
const expectedParsedValue = ["2024", "5"];
describe("parseYearMonthExpiry", () => {
  it('returns "null" expiration year and month values when a value of "" is passed', () => {
    expect(parseYearMonthExpiry("")).toStrictEqual([null, null]);
  });

  it('returns "null" expiration year and month values when a value of "/" is passed', () => {
    expect(parseYearMonthExpiry("/")).toStrictEqual([null, null]);
  });

  combinedDateTestValues.forEach((combinedDate) => {
    it(`returns an expiration year value of "${expectedParsedValue[0]}" and month value of "${expectedParsedValue[1]}" when a value of "${combinedDate}" is passed`, () => {
      expect(parseYearMonthExpiry(combinedDate)).toStrictEqual(expectedParsedValue);
    });
  });

  it('returns an expiration year value of "2002" and month value of "2" when a value of "022" is passed', () => {
    expect(parseYearMonthExpiry("022")).toStrictEqual(["2002", "2"]);
  });

  it('returns an expiration year value of "2002" and month value of "2" when a value of "202" is passed', () => {
    expect(parseYearMonthExpiry("202")).toStrictEqual(["2002", "2"]);
  });

  it('returns an expiration year value of "2002" and month value of "1" when a value of "1/2/3/4" is passed', () => {
    expect(parseYearMonthExpiry("1/2/3/4")).toStrictEqual(["2002", "1"]);
  });

  it('returns valid expiration year and month values when a value of "198" is passed', () => {
    // This static value will cause the test to fail in 2098
    const testValue = "198";
    const parsedValue = parseYearMonthExpiry(testValue);

    expect(parsedValue[0]).toHaveLength(4);
    expect(parsedValue[1]).toMatch(/^[\d]{1,2}$/);

    expect(parsedValue).toStrictEqual(["2098", "1"]);
  });

  // Ambiguous input cases: we use try/catch for these cases as a workaround to accept either
  // outcome (both are valid interpretations) in the event of any future code changes.
  describe("ambiguous input cases", () => {
    it('returns valid expiration year and month values when a value of "111" is passed', () => {
      const testValue = "111";
      const parsedValue = parseYearMonthExpiry(testValue);

      expect(parsedValue[0]).toHaveLength(4);
      expect(parsedValue[1]).toMatch(/^[\d]{1,2}$/);

      try {
        expect(parsedValue).toStrictEqual(["2011", "1"]);
      } catch {
        expect(parsedValue).toStrictEqual(["2001", "11"]);
      }
    });

    it('returns valid expiration year and month values when a value of "212" is passed', () => {
      const testValue = "212";
      const parsedValue = parseYearMonthExpiry(testValue);

      expect(parsedValue[0]).toHaveLength(4);
      expect(parsedValue[1]).toMatch(/^[\d]{1,2}$/);

      try {
        expect(parsedValue).toStrictEqual(["2012", "2"]);
      } catch {
        expect(parsedValue).toStrictEqual(["2021", "2"]);
      }
    });

    it('returns valid expiration year and month values when a value of "245" is passed', () => {
      const testValue = "245";
      const parsedValue = parseYearMonthExpiry(testValue);

      expect(parsedValue[0]).toHaveLength(4);
      expect(parsedValue[1]).toMatch(/^[\d]{1,2}$/);

      try {
        expect(parsedValue).toStrictEqual(["2045", "2"]);
      } catch {
        expect(parsedValue).toStrictEqual(["2024", "5"]);
      }
    });

    it('returns valid expiration year and month values when a value of "524" is passed', () => {
      const testValue = "524";
      const parsedValue = parseYearMonthExpiry(testValue);

      expect(parsedValue[0]).toHaveLength(4);
      expect(parsedValue[1]).toMatch(/^[\d]{1,2}$/);

      try {
        expect(parsedValue).toStrictEqual(["2024", "5"]);
      } catch {
        expect(parsedValue).toStrictEqual(["2052", "4"]);
      }
    });
  });
});

describe("isUrlInList", () => {
  let mockUrlList: NeverDomains;

  it("returns false if the passed URL list is empty", () => {
    const urlIsInList = isUrlInList("", mockUrlList);

    expect(urlIsInList).toEqual(false);
  });

  it("returns true if the URL hostname is on the passed URL list", () => {
    mockUrlList = {
      ["bitwarden.com"]: { bannerIsDismissed: true },
      ["duckduckgo.com"]: null,
      [".lan"]: null,
      [".net"]: null,
      ["localhost"]: null,
      ["extensions"]: null,
    };

    const testPages = [
      "https://www.bitwarden.com/landing-page?some_query_string_key=1&another_one=1",
      " https://duckduckgo.com/pro  ", // Note: embedded whitespacing is intentional
      "https://network-private-domain.lan/homelabs-dashboard",
      "https://jsfiddle.net/",
      "https://localhost:8443/#/login",
      "chrome://extensions/",
    ];

    for (const pageUrl of testPages) {
      const urlIsInList = isUrlInList(pageUrl, mockUrlList);

      expect(urlIsInList).toEqual(true);
    }
  });

  it("returns false if no items on the passed URL list are a full match for the page hostname", () => {
    const urlIsInList = isUrlInList("https://paypal.com/", {
      ["some.packed.subdomains.sandbox.paypal.com"]: null,
    });

    expect(urlIsInList).toEqual(false);
  });

  it("returns false if the URL hostname is not on the passed URL list", () => {
    const testPages = ["https://archive.org/", "bitwarden.com.some.otherdomain.com"];

    for (const pageUrl of testPages) {
      const urlIsInList = isUrlInList(pageUrl, mockUrlList);

      expect(urlIsInList).toEqual(false);
    }
  });

  it("returns false if the passed URL is empty", () => {
    const urlIsInList = isUrlInList("", mockUrlList);

    expect(urlIsInList).toEqual(false);
  });

  it("returns false if the passed URL is not a valid URL", () => {
    const testPages = ["twasbrillingandtheslithytoves", "/landing-page", undefined];

    for (const pageUrl of testPages) {
      const urlIsInList = isUrlInList(pageUrl, mockUrlList);

      expect(urlIsInList).toEqual(false);
    }
  });
});
