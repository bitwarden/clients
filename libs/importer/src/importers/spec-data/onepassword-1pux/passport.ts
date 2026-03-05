import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const PassportData: ExportData = {
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
              uuid: "hffila4ew2e3krfzp2tkdkdmea",
              favIndex: 0,
              createdAt: 1619467498,
              updatedAt: 1619467655,
              state: "active",
              categoryUuid: "106",
              details: {
                loginFields: [],
                notesPlain: "My Passport",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "type",
                        id: "type",
                        value: {
                          string: "US Passport",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "allCharacters",
                        },
                      },
                      {
                        title: "issuing country",
                        id: "issuing_country",
                        value: {
                          string: "United States of America",
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
                        title: "number",
                        id: "number",
                        value: {
                          string: "76436847",
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
                        title: "full name",
                        id: "fullname",
                        value: {
                          string: "David Global",
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
                        title: "sex",
                        id: "sex",
                        value: {
                          gender: "female",
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
                      {
                        title: "nationality",
                        id: "nationality",
                        value: {
                          string: "International",
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
                        title: "issuing authority",
                        id: "issuing_authority",
                        value: {
                          string: "Department of State",
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
                        title: "date of birth",
                        id: "birthdate",
                        value: {
                          date: 418046460,
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
                      {
                        title: "place of birth",
                        id: "birthplace",
                        value: {
                          string: "A cave somewhere in Maine",
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
                        title: "issued on",
                        id: "issue_date",
                        value: {
                          date: 1577880060,
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
                      {
                        title: "expiry date",
                        id: "expiry_date",
                        value: {
                          date: 2524651260,
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
                ],
                passwordHistory: [],
              },
              overview: {
                subtitle: "76436847",
                tags: ["Travel"],
                title: "Mr. Globewide",
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
