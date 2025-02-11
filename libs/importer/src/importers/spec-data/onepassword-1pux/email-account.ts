import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const EmailAccountData: ExportData = {
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
              uuid: "p3hohdgwpt4u2ra2fc3tvzomsm",
              favIndex: 0,
              createdAt: 1619466428,
              updatedAt: 1619466585,
              state: "active",
              categoryUuid: "111",
              details: {
                loginFields: [],
                notesPlain: "My Email Config",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "type",
                        id: "pop_type",
                        value: {
                          menu: "either",
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
                        title: "username",
                        id: "pop_username",
                        value: {
                          string: "someuser@nullvalue.test",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "no",
                          capitalization: "none",
                        },
                      },
                      {
                        title: "server",
                        id: "pop_server",
                        value: {
                          string: "mailserver.nullvalue.test",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "uRL",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "port number",
                        id: "pop_port",
                        value: {
                          string: "587",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "numberPad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "password",
                        id: "pop_password",
                        value: {
                          concealed: "u1jsf<UI*&YU&^T",
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
                        title: "security",
                        id: "pop_security",
                        value: {
                          menu: "TLS",
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
                        title: "auth method",
                        id: "pop_authentication",
                        value: {
                          menu: "kerberos_v5",
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
                    title: "SMTP",
                    name: "SMTP",
                    fields: [
                      {
                        title: "SMTP server",
                        id: "smtp_server",
                        value: {
                          string: "mailserver.nullvalue.test",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "uRL",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "port number",
                        id: "smtp_port",
                        value: {
                          string: "589",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "numberPad",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "username",
                        id: "smtp_username",
                        value: {
                          string: "someuser@nullvalue.test",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "no",
                          capitalization: "none",
                        },
                      },
                      {
                        title: "password",
                        id: "smtp_password",
                        value: {
                          concealed: "(*1674%^UIUJ*UI(IUI8u98uyy",
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
                        title: "security",
                        id: "smtp_security",
                        value: {
                          menu: "TLS",
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
                        title: "auth method",
                        id: "smtp_authentication",
                        value: {
                          menu: "password",
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
                    name: "Contact Information",
                    fields: [
                      {
                        title: "provider",
                        id: "provider",
                        value: {
                          string: "Telum",
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
                        title: "provider's website",
                        id: "provider_website",
                        value: {
                          string: "https://telum.nullvalue.test",
                        },
                        guarded: false,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "uRL",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "phone (local)",
                        id: "phone_local",
                        value: {
                          string: "2346666666",
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
                        id: "phone_tollfree",
                        value: {
                          string: "18005557777",
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
                    ],
                  },
                ],
                passwordHistory: [],
              },
              overview: {
                subtitle: "someuser@nullvalue.test",
                title: "Email Config",
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
