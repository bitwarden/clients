export class AutoFillConstants {
  static readonly EmailFieldNames: string[] = [
    // English
    "email",
    "email address",
    "e-mail",
    "e-mail address",
    // German
    "email adresse",
    "e-mail adresse",
  ];

  static readonly UsernameFieldNames: string[] = [
    // English
    "username",
    "user name",
    "userid",
    "user id",
    "customer id",
    "login id",
    "login",
    // German
    "benutzername",
    "benutzer name",
    "benutzerid",
    "benutzer id",
    ...AutoFillConstants.EmailFieldNames,
  ];

  static readonly TotpFieldNames: string[] = [
    "totp",
    "totpcode",
    "2facode",
    "approvals_code",
    "mfacode",
    "otc-code",
    "onetimecode",
    "otp-code",
    "otpcode",
    "onetimepassword",
    "security_code",
    "twofactor",
    "twofa",
    "twofactorcode",
    "verificationcode",
    "verification code",
  ];

  static readonly AmbiguousTotpFieldNames: string[] = ["code", "pin", "otc", "otp", "2fa", "mfa"];

  static readonly SearchFieldNames: string[] = ["search", "query", "find", "go"];

  static readonly NewEmailFieldKeywords: string[] = [
    "new-email",
    "newemail",
    "new email",
    "neue e-mail",
  ];

  static readonly NewsletterFormNames: string[] = ["newsletter"];

  static readonly FieldIgnoreList: string[] = ["captcha", "findanything", "forgot"];

  static readonly PasswordFieldExcludeList: string[] = [
    "hint",
    ...AutoFillConstants.FieldIgnoreList,
    ...AutoFillConstants.TotpFieldNames,
  ];

  static readonly ExcludedAutofillLoginTypes: string[] = [
    "hidden",
    "file",
    "button",
    "image",
    "reset",
    "search",
  ];

  static readonly ExcludedAutofillTypes: string[] = [
    "radio",
    "checkbox",
    ...AutoFillConstants.ExcludedAutofillLoginTypes,
  ];

  static readonly ExcludedInlineMenuTypes: string[] = [
    "textarea",
    ...AutoFillConstants.ExcludedAutofillTypes,
  ];

  static readonly ExcludedIdentityAutocompleteTypes: Set<string> = new Set([
    "current-password",
    "new-password",
  ]);

  static readonly ExcludedTotpFieldNames: string[] = ["backup", "recovery"];
}

export class CreditCardAutoFillConstants {
  static readonly CardAttributes: string[] = [
    "autoCompleteType",
    "data-stripe",
    "htmlName",
    "htmlID",
    "title",
    "label-tag",
    "placeholder",
    "label-left",
    "label-top",
    "data-recurly",
  ];

  static readonly CardAttributesExtended: string[] = [
    ...CreditCardAutoFillConstants.CardAttributes,
    "label-right",
  ];

  static readonly CardHolderFieldNames: string[] = [
    "accountholdername",
    "cc-name",
    "card-name",
    "cardholder-name",
    "cardholder",
    "name",
    "nom",
  ];

  static readonly CardHolderFieldNameValues: string[] = [
    "accountholdername",
    "cc-name",
    "card-name",
    "cardholder-name",
    "cardholder",
    "tbName",
  ];

  static readonly CardNumberFieldNames: string[] = [
    "cc-number",
    "cc-num",
    "card-number",
    "card-num",
    "number",
    "cc",
    "cc-no",
    "card-no",
    "credit-card",
    "numero-carte",
    "carte",
    "carte-credit",
    "num-carte",
    "cb-num",
    "card-pan",
  ];

  static readonly CardNumberFieldNameValues: string[] = [
    "cc-number",
    "cc-num",
    "card-number",
    "card-num",
    "cc-no",
    "card-no",
    "numero-carte",
    "num-carte",
    "cb-num",
  ];

  static readonly CardExpiryFieldNames: string[] = [
    "cc-exp",
    "card-exp",
    "cc-expiration",
    "card-expiration",
    "cc-ex",
    "card-ex",
    "card-expire",
    "card-expiry",
    "validite",
    "expiration",
    "expiry",
    "mm-yy",
    "mm-yyyy",
    "yy-mm",
    "yyyy-mm",
    "expiration-date",
    "payment-card-expiration",
    "payment-cc-date",
  ];

  static readonly CardExpiryFieldNameValues: string[] = [
    "mm-yy",
    "mm-yyyy",
    "yy-mm",
    "yyyy-mm",
    "expiration-date",
    "payment-card-expiration",
  ];

  static readonly ExpiryMonthFieldNames: string[] = [
    "exp-month",
    "cc-exp-month",
    "cc-month",
    "card-month",
    "cc-mo",
    "card-mo",
    "exp-mo",
    "card-exp-mo",
    "cc-exp-mo",
    "card-expiration-month",
    "expiration-month",
    "cc-mm",
    "cc-m",
    "card-mm",
    "card-m",
    "card-exp-mm",
    "cc-exp-mm",
    "exp-mm",
    "exp-m",
    "expire-month",
    "expire-mo",
    "expiry-month",
    "expiry-mo",
    "card-expire-month",
    "card-expire-mo",
    "card-expiry-month",
    "card-expiry-mo",
    "mois-validite",
    "mois-expiration",
    "m-validite",
    "m-expiration",
    "expiry-date-field-month",
    "expiration-date-month",
    "expiration-date-mm",
    "exp-mon",
    "validity-mo",
    "exp-date-mo",
    "cb-date-mois",
    "date-m",
  ];

  static readonly ExpiryYearFieldNames: string[] = [
    "exp-year",
    "cc-exp-year",
    "cc-year",
    "card-year",
    "cc-yr",
    "card-yr",
    "exp-yr",
    "card-exp-yr",
    "cc-exp-yr",
    "card-expiration-year",
    "expiration-year",
    "cc-yy",
    "cc-y",
    "card-yy",
    "card-y",
    "card-exp-yy",
    "cc-exp-yy",
    "exp-yy",
    "exp-y",
    "cc-yyyy",
    "card-yyyy",
    "card-exp-yyyy",
    "cc-exp-yyyy",
    "expire-year",
    "expire-yr",
    "expiry-year",
    "expiry-yr",
    "card-expire-year",
    "card-expire-yr",
    "card-expiry-year",
    "card-expiry-yr",
    "an-validite",
    "an-expiration",
    "annee-validite",
    "annee-expiration",
    "expiry-date-field-year",
    "expiration-date-year",
    "cb-date-ann",
    "expiration-date-yy",
    "expiration-date-yyyy",
    "validity-year",
    "exp-date-year",
    "date-y",
  ];

  static readonly CVVFieldNames: string[] = [
    "cvv",
    "cvc",
    "cvv2",
    "cc-csc",
    "cc-cvv",
    "card-csc",
    "card-cvv",
    "cvd",
    "cid",
    "cvc2",
    "cnv",
    "cvn2",
    "cc-code",
    "card-code",
    "code-securite",
    "security-code",
    "crypto",
    "card-verif",
    "verification-code",
    "csc",
    "ccv",
  ];

  static readonly CardBrandFieldNames: string[] = [
    "cc-type",
    "card-type",
    "card-brand",
    "cc-brand",
    "cb-type",
  ];

  // Note, these are expressions of user-guidance for the expected expiry date format to be used
  static readonly CardExpiryDateFormats: CardExpiryDateFormat[] = [
    // English
    {
      Month: "mm",
      MonthShort: "m",
      Year: "yyyy",
      YearShort: "yy",
    },
    // Danish
    {
      Month: "mm",
      MonthShort: "m",
      Year: "åååå",
      YearShort: "åå",
    },
    // German/Dutch
    {
      Month: "mm",
      MonthShort: "m",
      Year: "jjjj",
      YearShort: "jj",
    },
    // French/Spanish/Italian
    {
      Month: "mm",
      MonthShort: "m",
      Year: "aa",
      YearShort: "aa",
    },
    // Russian
    {
      Month: "мм",
      MonthShort: "м",
      Year: "гггг",
      YearShort: "гг",
    },
    // Portuguese
    {
      Month: "mm",
      MonthShort: "m",
      Year: "rrrr",
      YearShort: "rr",
    },
  ];

  // Each index represents a language. These three arrays should all be the same length.
  // 0: English, 1: Danish, 2: German/Dutch, 3: French/Spanish/Italian, 4: Russian, 5: Portuguese
  static readonly MonthAbbr = ["mm", "mm", "mm", "mm", "мм", "mm"];
  static readonly YearAbbrShort = ["yy", "åå", "jj", "aa", "гг", "rr"];
  static readonly YearAbbrLong = ["yyyy", "åååå", "jjjj", "aa", "гггг", "rrrr"];
}

export type CardExpiryDateFormat = {
  Month: string;
  MonthShort: string;
  Year: string;
  YearShort: string;
};

export class IdentityAutoFillConstants {
  static readonly IdentityAttributes: string[] = [
    "autoCompleteType",
    "data-stripe",
    "htmlName",
    "htmlID",
    "label-tag",
    "placeholder",
    "label-left",
    "label-top",
    "data-recurly",
    "accountCreationFieldType",
  ];

  static readonly FullNameFieldNames: string[] = ["name", "full-name", "your-name"];

  static readonly FullNameFieldNameValues: string[] = ["full-name", "your-name"];

  static readonly TitleFieldNames: string[] = [
    "honorific-prefix",
    "prefix",
    "title",
    // German
    "anrede",
  ];

  static readonly FirstnameFieldNames: string[] = [
    // English
    "f-name",
    "first-name",
    "given-name",
    "first-n",
    // German
    "vorname",
  ];

  static readonly MiddlenameFieldNames: string[] = [
    "m-name",
    "middle-name",
    "additional-name",
    "middle-initial",
    "middle-n",
    "middle-i",
  ];

  static readonly LastnameFieldNames: string[] = [
    // English
    "l-name",
    "last-name",
    "s-name",
    "surname",
    "family-name",
    "family-n",
    "last-n",
    // German
    "nachname",
    "familienname",
  ];

  static readonly EmailFieldNames: string[] = ["e-mail", "email-address"];

  static readonly AddressFieldNames: string[] = [
    "address",
    "street-address",
    "addr",
    "street",
    "mailing-addr",
    "billing-addr",
    "mail-addr",
    "bill-addr",
    // German
    "strasse",
    "adresse",
  ];

  static readonly AddressFieldNameValues: string[] = [
    "mailing-addr",
    "billing-addr",
    "mail-addr",
    "bill-addr",
  ];

  static readonly Address1FieldNames: string[] = [
    "address-1",
    "address-line-1",
    "addr-1",
    "street-1",
  ];

  static readonly Address2FieldNames: string[] = [
    "address-2",
    "address-line-2",
    "addr-2",
    "street-2",
    "address-ext",
  ];

  static readonly Address3FieldNames: string[] = [
    "address-3",
    "address-line-3",
    "addr-3",
    "street-3",
  ];

  static readonly PostalCodeFieldNames: string[] = [
    "postal",
    "zip",
    "zip2",
    "zip-code",
    "postal-code",
    "post-code",
    "postcode",
    "address-zip",
    "address-postal",
    "address-code",
    "address-postal-code",
    "address-zip-code",
    // German
    "plz",
    "postleitzahl",
  ];

  static readonly CityFieldNames: string[] = [
    "city",
    "town",
    "address-level-2",
    "address-city",
    "address-town",
    // German
    "ort",
    "stadt",
    "wohnort",
  ];

  static readonly StateFieldNames: string[] = [
    "state",
    "province",
    "provence",
    "address-level-1",
    "address-state",
    "address-province",
    // German
    "bundesland",
  ];

  static readonly CountryFieldNames: string[] = [
    "country",
    "country-code",
    "country-name",
    "address-country",
    "address-country-name",
    "address-country-code",
    // German
    "land",
  ];

  static readonly PhoneFieldNames: string[] = [
    "phone",
    "mobile",
    "mobile-phone",
    "tel",
    "telephone",
    "phone-number",
    // German
    "telefon",
    "telefonnummer",
    "mobil",
    "handy",
  ];

  static readonly UserNameFieldNames: string[] = ["user-name", "user-id", "screen-name"];

  static readonly CompanyFieldNames: string[] = [
    "company",
    "company-name",
    "organization",
    "organization-name",
    // German
    "firma",
  ];

  static readonly IsoCountries: { [id: string]: string } = {
    afghanistan: "AF",
    "aland islands": "AX",
    albania: "AL",
    algeria: "DZ",
    "american samoa": "AS",
    andorra: "AD",
    angola: "AO",
    anguilla: "AI",
    antarctica: "AQ",
    "antigua and barbuda": "AG",
    argentina: "AR",
    armenia: "AM",
    aruba: "AW",
    australia: "AU",
    austria: "AT",
    azerbaijan: "AZ",
    bahamas: "BS",
    bahrain: "BH",
    bangladesh: "BD",
    barbados: "BB",
    belarus: "BY",
    belgium: "BE",
    belize: "BZ",
    benin: "BJ",
    bermuda: "BM",
    bhutan: "BT",
    bolivia: "BO",
    "bosnia and herzegovina": "BA",
    botswana: "BW",
    "bouvet island": "BV",
    brazil: "BR",
    "british indian ocean territory": "IO",
    "brunei darussalam": "BN",
    bulgaria: "BG",
    "burkina faso": "BF",
    burundi: "BI",
    cambodia: "KH",
    cameroon: "CM",
    canada: "CA",
    "cape verde": "CV",
    "cayman islands": "KY",
    "central african republic": "CF",
    chad: "TD",
    chile: "CL",
    china: "CN",
    "christmas island": "CX",
    "cocos (keeling) islands": "CC",
    colombia: "CO",
    comoros: "KM",
    congo: "CG",
    "congo, democratic republic": "CD",
    "cook islands": "CK",
    "costa rica": "CR",
    "cote d'ivoire": "CI",
    croatia: "HR",
    cuba: "CU",
    cyprus: "CY",
    "czech republic": "CZ",
    denmark: "DK",
    djibouti: "DJ",
    dominica: "DM",
    "dominican republic": "DO",
    ecuador: "EC",
    egypt: "EG",
    "el salvador": "SV",
    "equatorial guinea": "GQ",
    eritrea: "ER",
    estonia: "EE",
    ethiopia: "ET",
    "falkland islands": "FK",
    "faroe islands": "FO",
    fiji: "FJ",
    finland: "FI",
    france: "FR",
    "french guiana": "GF",
    "french polynesia": "PF",
    "french southern territories": "TF",
    gabon: "GA",
    gambia: "GM",
    georgia: "GE",
    germany: "DE",
    ghana: "GH",
    gibraltar: "GI",
    greece: "GR",
    greenland: "GL",
    grenada: "GD",
    guadeloupe: "GP",
    guam: "GU",
    guatemala: "GT",
    guernsey: "GG",
    guinea: "GN",
    "guinea-bissau": "GW",
    guyana: "GY",
    haiti: "HT",
    "heard island & mcdonald islands": "HM",
    "holy see (vatican city state)": "VA",
    honduras: "HN",
    "hong kong": "HK",
    hungary: "HU",
    iceland: "IS",
    india: "IN",
    indonesia: "ID",
    "iran, islamic republic of": "IR",
    iraq: "IQ",
    ireland: "IE",
    "isle of man": "IM",
    israel: "IL",
    italy: "IT",
    jamaica: "JM",
    japan: "JP",
    jersey: "JE",
    jordan: "JO",
    kazakhstan: "KZ",
    kenya: "KE",
    kiribati: "KI",
    "republic of korea": "KR",
    "south korea": "KR",
    "democratic people's republic of korea": "KP",
    "north korea": "KP",
    kuwait: "KW",
    kyrgyzstan: "KG",
    "lao people's democratic republic": "LA",
    latvia: "LV",
    lebanon: "LB",
    lesotho: "LS",
    liberia: "LR",
    "libyan arab jamahiriya": "LY",
    liechtenstein: "LI",
    lithuania: "LT",
    luxembourg: "LU",
    macao: "MO",
    macedonia: "MK",
    madagascar: "MG",
    malawi: "MW",
    malaysia: "MY",
    maldives: "MV",
    mali: "ML",
    malta: "MT",
    "marshall islands": "MH",
    martinique: "MQ",
    mauritania: "MR",
    mauritius: "MU",
    mayotte: "YT",
    mexico: "MX",
    "micronesia, federated states of": "FM",
    moldova: "MD",
    monaco: "MC",
    mongolia: "MN",
    montenegro: "ME",
    montserrat: "MS",
    morocco: "MA",
    mozambique: "MZ",
    myanmar: "MM",
    namibia: "NA",
    nauru: "NR",
    nepal: "NP",
    netherlands: "NL",
    "netherlands antilles": "AN",
    "new caledonia": "NC",
    "new zealand": "NZ",
    nicaragua: "NI",
    niger: "NE",
    nigeria: "NG",
    niue: "NU",
    "norfolk island": "NF",
    "northern mariana islands": "MP",
    norway: "NO",
    oman: "OM",
    pakistan: "PK",
    palau: "PW",
    "palestinian territory, occupied": "PS",
    panama: "PA",
    "papua new guinea": "PG",
    paraguay: "PY",
    peru: "PE",
    philippines: "PH",
    pitcairn: "PN",
    poland: "PL",
    portugal: "PT",
    "puerto rico": "PR",
    qatar: "QA",
    reunion: "RE",
    romania: "RO",
    "russian federation": "RU",
    rwanda: "RW",
    "saint barthelemy": "BL",
    "saint helena": "SH",
    "saint kitts and nevis": "KN",
    "saint lucia": "LC",
    "saint martin": "MF",
    "saint pierre and miquelon": "PM",
    "saint vincent and grenadines": "VC",
    samoa: "WS",
    "san marino": "SM",
    "sao tome and principe": "ST",
    "saudi arabia": "SA",
    senegal: "SN",
    serbia: "RS",
    seychelles: "SC",
    "sierra leone": "SL",
    singapore: "SG",
    slovakia: "SK",
    slovenia: "SI",
    "solomon islands": "SB",
    somalia: "SO",
    "south africa": "ZA",
    "south georgia and sandwich isl.": "GS",
    spain: "ES",
    "sri lanka": "LK",
    sudan: "SD",
    suriname: "SR",
    "svalbard and jan mayen": "SJ",
    swaziland: "SZ",
    sweden: "SE",
    switzerland: "CH",
    "syrian arab republic": "SY",
    taiwan: "TW",
    tajikistan: "TJ",
    tanzania: "TZ",
    thailand: "TH",
    "timor-leste": "TL",
    togo: "TG",
    tokelau: "TK",
    tonga: "TO",
    "trinidad and tobago": "TT",
    tunisia: "TN",
    turkey: "TR",
    turkmenistan: "TM",
    "turks and caicos islands": "TC",
    tuvalu: "TV",
    uganda: "UG",
    ukraine: "UA",
    "united arab emirates": "AE",
    "united kingdom": "GB",
    "united states": "US",
    "united states outlying islands": "UM",
    uruguay: "UY",
    uzbekistan: "UZ",
    vanuatu: "VU",
    venezuela: "VE",
    vietnam: "VN",
    "virgin islands, british": "VG",
    "virgin islands, u.s.": "VI",
    "wallis and futuna": "WF",
    "western sahara": "EH",
    yemen: "YE",
    zambia: "ZM",
    zimbabwe: "ZW",
  };

  static readonly IsoStates: { [id: string]: string } = {
    alabama: "AL",
    alaska: "AK",
    "american samoa": "AS",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    "district of columbia": "DC",
    "federated states of micronesia": "FM",
    florida: "FL",
    georgia: "GA",
    guam: "GU",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    "marshall islands": "MH",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "northern mariana islands": "MP",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    palau: "PW",
    pennsylvania: "PA",
    "puerto rico": "PR",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    "virgin islands": "VI",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY",
  };

  static readonly IsoProvinces: { [id: string]: string } = {
    alberta: "AB",
    "british columbia": "BC",
    manitoba: "MB",
    "new brunswick": "NB",
    "newfoundland and labrador": "NL",
    "nova scotia": "NS",
    ontario: "ON",
    "prince edward island": "PE",
    quebec: "QC",
    saskatchewan: "SK",
  };
}

export const SubmitLoginButtonNames: string[] = [
  "login",
  "signin",
  "submit",
  "continue",
  "next",
  "verify",
];

export const SubmitChangePasswordButtonNames: string[] = [
  "change",
  "save",
  "savepassword",
  "updatepassword",
  "changepassword",
  "resetpassword",
];
