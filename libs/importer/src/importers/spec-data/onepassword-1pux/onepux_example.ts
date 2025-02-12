import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const OnePuxExampleFile: ExportData = {
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
              uuid: "fkruyzrldvizuqlnavfj3gltfe",
              favIndex: 1,
              createdAt: 1614298956,
              updatedAt: 1635346445,
              state: "active",
              categoryUuid: "001",
              details: {
                loginFields: [
                  {
                    value: "most-secure-password-ever!",
                    id: "",
                    name: "password",
                    fieldType: "P",
                    designation: "password",
                  },
                ],
                notesPlain: "This is a note. *bold*! _italic_!",
                sections: [
                  {
                    title: "Security",
                    name: "Section_oazxddhvftfknycbbmh5ntwfa4",
                    fields: [
                      {
                        title: "PIN",
                        id: "CCEF647B399604E8F6Q6C8C3W31AFD407",
                        value: {
                          concealed: "12345",
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
                    value: "12345password",
                    time: 1458322355,
                  },
                ],
              },
              overview: {
                subtitle: "",
                urls: [
                  {
                    label: "",
                    url: "https://www.dropbox.com/",
                  },
                ],
                title: "Dropbox",
                url: "https://www.dropbox.com/",
                ps: 100,
                pbe: 86.13621,
                pgrng: true,
              },
            },
          ],
        },
      ],
    },
  ],
};
