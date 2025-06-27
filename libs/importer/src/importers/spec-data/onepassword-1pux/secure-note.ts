import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const SecureNoteData: ExportData = {
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
              uuid: "gcozv72svonjgufn4q5hnyzwmu",
              favIndex: 0,
              createdAt: 1619465226,
              updatedAt: 1619465278,
              state: "active",
              categoryUuid: "003",
              details: {
                loginFields: [],
                notesPlain:
                  "This is my secure note. \n\nLorem ipsum expecto patronum. \nThe quick brown fox jumped over the lazy dog. ",
                sections: [],
                passwordHistory: [],
              },
              overview: {
                subtitle: "This is my secure note. ",
                title: "Secure Note #1",
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
