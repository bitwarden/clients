import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const EmailFieldData: ExportData = {
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
              uuid: "47hvppiuwbanbza7bq6jpdjfxu",
              favIndex: 1,
              createdAt: 1619467985,
              updatedAt: 1619468230,
              state: "active",
              categoryUuid: "100",
              details: {
                loginFields: [],
                notesPlain: "My Software License",
                sections: [
                  {
                    title: "",
                    fields: [],
                  },
                  {
                    title: "Customer",
                    name: "customer",
                    fields: [
                      {
                        title: "registered email",
                        id: "reg_email",
                        value: {
                          email: {
                            email_address: "kriddler@nullvalue.test",
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
                  {
                    title: "Publisher",
                    name: "publisher",
                    fields: [],
                  },
                  {
                    title: "Order",
                    name: "order",
                    fields: [],
                  },
                ],
                passwordHistory: [],
              },
              overview: {
                subtitle: "5.10.1000",
                title: "Limux Product Key",
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
