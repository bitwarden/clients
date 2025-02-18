import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const WirelessRouterData: ExportData = {
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
              uuid: "fnnva6qkqdc3bv3qte2npnz6l4",
              favIndex: 0,
              createdAt: 1577652307,
              updatedAt: 1577652307,
              state: "active",
              categoryUuid: "109",
              details: {
                loginFields: [],
                notesPlain: "My Wifi Router Config",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "base station name",
                        id: "name",
                        value: {
                          string: "pixel 2Xl",
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
                        title: "base station password",
                        id: "password",
                        value: {
                          concealed: "BqatGTVQ9TCN72tLbjrsHqkb",
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
                        title: "server / ip address",
                        id: "server",
                        value: {
                          string: "127.0.0.1",
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
                        title: "airport id",
                        id: "airport_id",
                        value: {
                          string: "some airportId",
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
                        title: "network name",
                        id: "network_name",
                        value: {
                          string: "some network name",
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
                        title: "wireless security",
                        id: "wireless_security",
                        value: {
                          menu: "WPA",
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
                        title: "wireless network password",
                        id: "wireless_password",
                        value: {
                          concealed: "wifipassword",
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
                        title: "attached storage password",
                        id: "disk_password",
                        value: {
                          concealed: "diskpassword",
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
                passwordHistory: [],
              },
              overview: {
                subtitle: "",
                title: "Wireless Router",
                url: "",
              },
            },
          ],
        },
      ],
    },
  ],
};
