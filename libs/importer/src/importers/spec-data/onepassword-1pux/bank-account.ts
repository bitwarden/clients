import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const BankAccountData: ExportData = {
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
              uuid: "u2l4sjbencvsowwjuj3dfpt73q",
              favIndex: 0,
              createdAt: 1619466056,
              updatedAt: 1619466187,
              state: "active",
              categoryUuid: "101",
              details: {
                loginFields: [],
                notesPlain: "My Bank Account",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "bank name",
                        id: "bankName",
                        value: {
                          string: "Super Credit Union",
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
                        title: "name on account",
                        id: "owner",
                        value: {
                          string: "Cool Guy",
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
                        title: "type",
                        id: "accountType",
                        value: {
                          menu: "checking",
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
                        title: "routing number",
                        id: "routingNo",
                        value: {
                          string: "111000999",
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
                        title: "account number",
                        id: "accountNo",
                        value: {
                          string: "192837465918273645",
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
                        title: "SWIFT",
                        id: "swift",
                        value: {
                          string: "123456",
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
                        title: "IBAN",
                        id: "iban",
                        value: {
                          string: "DE12 123456",
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
                        title: "PIN",
                        id: "telephonePin",
                        value: {
                          concealed: "5555",
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
                    ],
                  },
                  {
                    title: "Branch Information",
                    name: "branchInfo",
                    fields: [
                      {
                        title: "phone",
                        id: "branchPhone",
                        value: {
                          phone: "9399399933",
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
                        title: "address",
                        id: "branchAddress",
                        value: {
                          string: "1 Fifth Avenue",
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
                    ],
                  },
                ],
                passwordHistory: [],
              },
              overview: {
                subtitle: "Super Credit Union",
                tags: ["Finance"],
                title: "Bank Account",
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
