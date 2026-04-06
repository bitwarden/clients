import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const CreditCardData: ExportData = {
  accounts: [
    {
      attrs: {
        accountName: "1Password Customer",
        name: "1Password Customer",
        avatar: "",
        email: "username123123123@gmail.com",
        uuid: "TRIZ3XV4JJFRXJ3BARILLTUA6E",
        domain: "https://my.1password.com/",
      },
      vaults: [
        {
          attrs: {
            uuid: "pqcgbqjxr4tng2hsqt5ffrgwju",
            desc: "Just test entries",
            avatar: "ke7i5rxnjrh3tj6uesstcosspu.png",
            name: "T's Test Vault",
            type: "U",
          },
          items: [
            {
              uuid: "vpxi2esuujz7nrbojp34rd5aja",
              favIndex: 0,
              createdAt: 1619465282,
              updatedAt: 1619465447,
              state: "active",
              categoryUuid: "002",
              details: {
                loginFields: [],
                notesPlain: "My parents' credit card. ",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "cardholder name",
                        id: "cardholder",
                        value: {
                          string: "Fred Engels",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "words",
                        },
                      },
                      {
                        title: "type",
                        id: "type",
                        value: {
                          creditCardType: "discover",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "number",
                        id: "ccnum",
                        value: {
                          creditCardNumber: "6011111111111117",
                        },
                        guarded: true,
                        clipboardFilter: "0123456789",
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "numberPad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "verification number",
                        id: "cvv",
                        value: {
                          concealed: "1312",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: true,
                        inputTraits: {
                          keyboard: "numberPad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "expiry date",
                        id: "expiry",
                        value: {
                          monthYear: 209912,
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "valid from",
                        id: "validFrom",
                        value: {
                          monthYear: 200101,
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "",
                        id: "txbzvwzpck7ejhfres3733rbpm",
                        value: {
                          string: "card",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                    ],
                  },
                  {
                    title: "Contact Information",
                    name: "contactInfo",
                    fields: [
                      {
                        title: "issuing bank",
                        id: "bank",
                        value: {
                          string: "Some bank",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "words",
                        },
                      },
                      {
                        title: "phone (local)",
                        id: "phoneLocal",
                        value: {
                          phone: "123456",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "namePhonePad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "phone (toll free)",
                        id: "phoneTollFree",
                        value: {
                          phone: "0800123456",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "namePhonePad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "phone (intl)",
                        id: "phoneIntl",
                        value: {
                          phone: "+49123456",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "namePhonePad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "website",
                        id: "website",
                        value: {
                          url: "somebank.com",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                    ],
                  },
                  {
                    title: "Additional Details",
                    name: "details",
                    fields: [
                      {
                        title: "PIN",
                        id: "pin",
                        value: {
                          concealed: "1234",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: true,
                        inputTraits: {
                          keyboard: "numberPad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "credit limit",
                        id: "creditLimit",
                        value: {
                          string: "$1312",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "numbersAndPunctuation",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "cash withdrawal limit",
                        id: "cashLimit",
                        value: {
                          string: "$500",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "numbersAndPunctuation",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "interest rate",
                        id: "interest",
                        value: {
                          string: "1%",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "numbersAndPunctuation",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "issue number",
                        id: "issuenumber",
                        value: {
                          string: "123456",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "no",
                          capitalization: "default",
                        },
                      },
                    ],
                  },
                ],
                passwordHistory: [],
              },
              overview: {
                subtitle: "1234 **** 6789",
                tags: ["Finance"],
                title: "Parent's Credit Card",
                url: "",
                ps: 0,
                pbe: 0.0,
                pgrng: false,
              },
            },
          ],
        },
      ],
    },
  ],
};
