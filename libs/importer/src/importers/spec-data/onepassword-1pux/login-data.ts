import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const LoginData: ExportData = {
  accounts: [
    {
      attrs: {
        accountName: "Wendy Appleseed",
        name: "Wendy Appleseed",
        avatar: "profile-pic.png",
        email: "wendy.c.appleseed@gmail.com",
        uuid: "D4RI47B7BJDT25C2LWA7LEJLHZ",
        domain: "https://my.1password.com/",
      },
      vaults: [
        {
          attrs: {
            uuid: "rr3lr6c2opoggvrete23q72ahi",
            desc: "",
            avatar: "pic.png",
            name: "Personal",
            type: "P",
          },
          items: [
            {
              uuid: "2b3hr6p5hinr7prtrj65bwmxqu",
              favIndex: 0,
              createdAt: 1635522833,
              updatedAt: 1635522872,
              state: "active",
              categoryUuid: "001",
              details: {
                loginFields: [
                  {
                    value: "username123123123@gmail.com",
                    id: "",
                    name: "email",
                    fieldType: "E",
                    designation: "username",
                  },
                  {
                    value: "password!",
                    id: "",
                    name: "password",
                    fieldType: "P",
                    designation: "password",
                  },
                  {
                    value: "",
                    id: "terms",
                    name: "terms",
                    fieldType: "C",
                  },
                  {
                    value: "✓",
                    id: "policies",
                    name: "policies",
                    fieldType: "C",
                  },
                ],
                sections: [
                  {
                    title: "Saved on www.fakesite.com",
                    name: "Section_mlvk6wzoifml4rbs4c3rfu4e2a",
                    fields: [
                      {
                        title: "Create an account",
                        id: "cyqyggt2otns6tbbqtsl6w2ceu",
                        value: {
                          string: "username123123",
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
                        title: "one-time password",
                        id: "TOTP_564mvwqapphpsjetnnuovmuxum",
                        value: {
                          totp: "otpseed777",
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
                passwordHistory: [
                  {
                    value: "123uio123oiu123uiopassword",
                    time: 1635522872,
                  },
                  {
                    value: "123uio123oiu123uiopassword123",
                    time: 1635522854,
                  },
                  {
                    value: "123uio123oiu123uiopassword123123",
                    time: 1635522848,
                  },
                ],
              },
              overview: {
                subtitle: "username123123@gmail.com",
                urls: [
                  {
                    label: "website",
                    url: "https://www.fakesite.com",
                  },
                ],
                title: "eToro",
                url: "https://www.fakesite.com",
                ps: 54,
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
