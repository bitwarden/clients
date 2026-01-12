import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const SSNData: ExportData = {
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
              uuid: "vi2biozc7sjnhr5sejk74nz26i",
              favIndex: 1,
              createdAt: 1619467910,
              updatedAt: 1619467982,
              state: "active",
              categoryUuid: "108",
              details: {
                loginFields: [],
                notesPlain: "My SSN",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "name",
                        id: "name",
                        value: {
                          string: "Jack Judd",
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
                          concealed: "131-216-1900",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: true,
                        inputTraits: {
                          keyboard: "numbersAndPunctuation",
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
                subtitle: "Jack Judd",
                title: "SSN",
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
