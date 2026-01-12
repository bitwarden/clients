import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const PasswordData: ExportData = {
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
              uuid: "qpdsrgpngzud3x3rbfvyrz3ane",
              favIndex: 0,
              createdAt: 1619465796,
              updatedAt: 1619465869,
              state: "active",
              categoryUuid: "005",
              details: {
                loginFields: [],
                notesPlain: "SuperSecret Password Notes",
                sections: [],
                passwordHistory: [],
                password: "GBq[AGb]4*Si3tjwuab^",
              },
              overview: {
                subtitle: "April 26, 2021 2:36 PM",
                urls: [
                  {
                    label: "website",
                    url: "https://n0t.y0ur.n0rm4l.w3bs1t3",
                  },
                ],
                title: "SuperSecret Password",
                url: "https://n0t.y0ur.n0rm4l.w3bs1t3",
                ps: 100,
                pbe: 127.500786,
                pgrng: true,
              },
            },
          ],
        },
      ],
    },
  ],
};
