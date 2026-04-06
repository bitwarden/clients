import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const DriversLicenseData: ExportData = {
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
              uuid: "nntuge2g7s2wrlokyfhea354ay",
              favIndex: 0,
              createdAt: 1619466279,
              updatedAt: 1619466425,
              state: "active",
              categoryUuid: "103",
              details: {
                loginFields: [],
                notesPlain: "My Driver's License",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "full name",
                        id: "fullname",
                        value: {
                          string: "Michael Scarn",
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
                        title: "address",
                        id: "address",
                        value: {
                          string: "2120 Mifflin Rd.",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "sentences",
                        },
                      },
                      {
                        title: "date of birth",
                        id: "birthdate",
                        value: {
                          date: 252504060,
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
                        title: "sex",
                        id: "sex",
                        value: {
                          gender: "male",
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
                        title: "height",
                        id: "height",
                        value: {
                          string: "5'11\"",
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
                        title: "number",
                        id: "number",
                        value: {
                          string: "12345678901",
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
                        title: "license class",
                        id: "class",
                        value: {
                          string: "C",
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
                        title: "conditions / restrictions",
                        id: "conditions",
                        value: {
                          string: "B",
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
                        title: "state",
                        id: "state",
                        value: {
                          string: "Pennsylvania",
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
                        title: "country",
                        id: "country",
                        value: {
                          string: "United States",
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
                          monthYear: 203012,
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
                subtitle: "12345678901",
                title: "Michael Scarn",
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
