import { ExportData } from "../../../src/importers/onepassword/types/onepassword-1pux-importer-types";

export const SSH_KeyData: ExportData = {
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
              uuid: "kf7wevmfiqmbgyao42plvgrasy",
              favIndex: 0,
              createdAt: 1724868152,
              updatedAt: 1724868152,
              state: "active",
              categoryUuid: "114",
              details: {
                loginFields: [],
                notesPlain: "SSH Key Note",
                sections: [
                  {
                    title: "SSH Key Section",
                    fields: [
                      {
                        title: "private key",
                        id: "private_key",
                        value: {
                          sshKey: {
                            privateKey:
                              "-----BEGIN PRIVATE KEY-----\nMFECAQEwBQYDK2VwBCIEIDn1BgTbZ/5UUeGLIfVV+qLBOvEsS3XMK6Twzw2Dkukq\ngSEAlrKdxRVVQrBndt4bHEZAz3xsymfM9Vf2QfZ823QxUbM=\n-----END PRIVATE KEY-----\n",
                            metadata: {
                              privateKey:
                                "-----BEGIN PRIVATE KEY-----\nMFECAQEwBQYDK2VwBCIEIDn1BgTbZ/5UUeGLIfVV+qLBOvEsS3XMK6Twzw2Dkukq\ngSEAlrKdxRVVQrBndt4bHEZAz3xsymfM9Vf2QfZ823QxUbM=\n-----END PRIVATE KEY-----\n",
                              publicKey:
                                "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJayncUVVUKwZ3beGxxGQM98bMpnzPVX9kH2fNt0MVGz",
                              fingerprint: "SHA256:/9qSxXuic8kaVBhwv3c8PuetiEpaOgIp7xHNCbcSuN8",
                              keyType: "ed25519",
                            },
                          },
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                    ],
                    hideAddAnotherField: true,
                  },
                ],
                passwordHistory: [],
              },
              overview: {
                subtitle: "SHA256:/9qSxXuic8kaVBhwv3c8PuetiEpaOgIp7xHNCbcSuN8",
                icons: null,
                title: "Some SSH Key",
                url: "",
                watchtowerExclusions: null,
              },
            },
          ],
        },
      ],
    },
  ],
};
