import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const EmailFieldOnIdentityData: ExportData = {
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
              uuid: "45mjttbbq3owgij2uis55pfrlq",
              favIndex: 0,
              createdAt: 1619465450,
              updatedAt: 1619465789,
              state: "active",
              categoryUuid: "004",
              details: {
                loginFields: [],
                notesPlain: "",
                sections: [
                  {
                    title: "Identification",
                    name: "name",
                    fields: [],
                  },
                  {
                    title: "Address",
                    name: "address",
                    fields: [],
                  },
                  {
                    title: "Internet Details",
                    name: "internet",
                    fields: [
                      {
                        title: "E-mail",
                        id: "E-mail",
                        value: {
                          email: {
                            email_address: "gengels@nullvalue.test",
                            provider: "myEmailProvider",
                          },
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "emailAddress",
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
                subtitle: "George Engels",
                title: "George Engels",
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
