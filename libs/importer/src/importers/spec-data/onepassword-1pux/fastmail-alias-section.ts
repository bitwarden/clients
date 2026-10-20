import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const FastmailAliasSectionData: ExportData = {
  accounts: [
    {
      attrs: {
        accountName: "1Password Customer",
        name: "1Password Customer",
        avatar: "",
        email: "user@example.com",
        uuid: "TRIZ3XV4JJFRXJ3BARILLTUA6E",
        domain: "https://my.1password.com/",
      },
      vaults: [
        {
          attrs: {
            uuid: "pqcgbqjxr4tng2hsqt5ffrgwju",
            desc: "Test vault",
            avatar: "",
            name: "Test Vault",
            type: "U",
          },
          items: [
            {
              uuid: "fastmail-alias-section-uuid",
              favIndex: 0,
              createdAt: 1724868152,
              updatedAt: 1724868152,
              state: "active",
              categoryUuid: "001",
              details: {
                loginFields: [],
                notesPlain: "",
                sections: [
                  {
                    title: "Login",
                    fields: [
                      {
                        title: "username",
                        id: "username",
                        value: {
                          email: {
                            email_address: "alias@fastmail.com",
                            provider: {
                              fastmail: { aliasId: "masked-123456", accountId: "123abcde" },
                            },
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
                      {
                        title: "Recovery alias",
                        id: "recovery_alias",
                        value: {
                          email: {
                            email_address: "recovery@fastmail.com",
                            provider: {
                              fastmail: { aliasId: "masked-654321", accountId: "123abcde" },
                            },
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
                subtitle: "",
                title: "Fastmail Login",
                url: "",
                ps: 0,
                pbe: 0,
                pgrng: false,
              },
            },
          ],
        },
      ],
    },
  ],
};
