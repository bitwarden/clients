import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const ServerData: ExportData = {
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
              uuid: "35szbzswhgeq3wyblg7odmshhu",
              favIndex: 0,
              createdAt: 1619467769,
              updatedAt: 1619467906,
              state: "active",
              categoryUuid: "110",
              details: {
                loginFields: [],
                notesPlain: "My Server",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "URL",
                        id: "url",
                        value: {
                          string: "https://coolserver.nullvalue.test",
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
                        title: "username",
                        id: "username",
                        value: {
                          string: "frankly-notsure",
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
                        id: "password",
                        value: {
                          concealed: "*&YHJI87yjy78u",
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
                    title: "Admin Console",
                    name: "admin_console",
                    fields: [
                      {
                        title: "admin console URL",
                        id: "admin_console_url",
                        value: {
                          string: "https://coolserver.nullvalue.test/admin",
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
                        title: "admin console username",
                        id: "admin_console_username",
                        value: {
                          string: "frankly-idontknowwhatimdoing",
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
                        title: "console password",
                        id: "admin_console_password",
                        value: {
                          concealed: "^%RY&^YUiju8iUYHJI(U",
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
                    title: "Hosting Provider",
                    name: "hosting_provider_details",
                    fields: [
                      {
                        title: "name",
                        id: "name",
                        value: {
                          string: "Private Hosting Provider Inc.",
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
                        title: "website",
                        id: "website",
                        value: {
                          string: "https://phpi.nullvalue.test",
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
                        title: "support URL",
                        id: "support_contact_url",
                        value: {
                          string: "https://phpi.nullvalue.test/support",
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
                        title: "support phone",
                        id: "support_contact_phone",
                        value: {
                          string: "8882569382",
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
                subtitle: "frankly-notsure",
                title: "Super Cool Server",
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
