export const PassportTestData =
  JSON.stringify({
    uuid: "d4zzyeokxa6bsvhiblqd73a4sy",
    updatedAt: 1780951495,
    securityLevel: "SL5",
    contentsHash: "d09f1859",
    title: "Test Passport",
    secureContents: {
      issuing_country: "The Shire",
      birthdate_yy: "2027",
      nationality: "Hobbit",
      birthplace: "Bag End, The Shire",
      birthdate_mm: "9",
      expiry_date_mm: "6",
      birthdate_dd: "22",
      issue_date_mm: "6",
      issue_date_yy: "2027",
      type: "Shire Passport",
      sections: [
        {
          fields: [
            {
              k: "string",
              v: "Shire Passport",
              n: "type",
              inputTraits: {
                autocapitalization: "AllCharacters",
              },
              t: "type",
            },
            {
              k: "string",
              v: "The Shire",
              n: "issuing_country",
              inputTraits: {
                autocapitalization: "Words",
              },
              t: "issuing country",
            },
            {
              k: "string",
              v: "1234567890",
              n: "number",
              inputTraits: {
                keyboard: "NamePhonePad",
              },
              t: "number",
            },
            {
              k: "string",
              v: "Bilbo Baggins",
              n: "fullname",
              inputTraits: {
                autocapitalization: "Words",
              },
              t: "full name",
            },
            {
              k: "string",
              n: "gender",
              v: "Male",
              t: "gender",
            },
            {
              k: "string",
              v: "Shire-folk",
              n: "nationality",
              inputTraits: {
                autocapitalization: "Words",
              },
              t: "nationality",
            },
            {
              k: "string",
              v: "The Shire",
              n: "issuing_authority",
              inputTraits: {
                autocapitalization: "Words",
              },
              t: "issuing authority",
            },
            {
              k: "date",
              n: "birthdate",
              v: 29055283200,
              t: "date of birth",
            },
            {
              k: "string",
              v: "Bag End, The Shire",
              n: "birthplace",
              inputTraits: {
                autocapitalization: "Words",
              },
              t: "place of birth",
            },
            {
              k: "date",
              n: "issue_date",
              v: 30656448000,
              t: "issued on",
            },
            {
              k: "date",
              v: 30971980800,
              n: "expiry_date",
              a: {
                alertAt: ["nineMonths", 23328000],
              },
              t: "expiry date",
            },
          ],
          title: "",
          name: "",
        },
      ],
      issue_date_dd: "19",
      number: "1234567890",
      expiry_date_dd: "19",
      expiry_date_yy: "2037",
      fullname: "Bilbo Baggins",
      issuing_authority: "The Shire",
    },
    createdAt: 1780951495,
    typeName: "wallet.government.Passport",
  }) + "\n***aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee***";
