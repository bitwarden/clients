import { ExportData } from "../../onepassword/types/onepassword-1pux-importer-types";

export const MedicalRecordData: ExportData = {
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
              uuid: "42mj5boh5rxq7uqjrmkslmhosu",
              favIndex: 0,
              createdAt: 1641220207,
              updatedAt: 1641220326,
              state: "active",
              categoryUuid: "113",
              details: {
                loginFields: [],
                notesPlain: "Some notes about my medical history",
                sections: [
                  {
                    title: "",
                    fields: [
                      {
                        title: "date",
                        id: "date",
                        value: {
                          date: 1641038460,
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
                      {
                        title: "location",
                        id: "location",
                        value: {
                          string: "some hospital/clinic",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        placeholder: "locationplaceholder",
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "healthcare professional",
                        id: "healthcareprofessional",
                        value: {
                          string: "Some Doctor",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        placeholder: "nameplaceholder",
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "words",
                        },
                      },
                      {
                        title: "patient",
                        id: "patient",
                        value: {
                          string: "Me",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        placeholder: "nameplaceholder",
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "words",
                        },
                      },
                      {
                        title: "reason for visit",
                        id: "reason",
                        value: {
                          string: "unwell",
                        },
                        guarded: true,
                        multiline: true,
                        dontGenerate: false,
                        placeholder: "reasonplaceholder",
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "sentences",
                        },
                      },
                    ],
                  },
                  {
                    title: "medication",
                    name: "medication",
                    fields: [
                      {
                        title: "medication",
                        id: "medication",
                        value: {
                          string: "Insuline",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        placeholder: "medicationplaceholder",
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "words",
                        },
                      },
                      {
                        title: "dosage",
                        id: "dosage",
                        value: {
                          string: "1",
                        },
                        guarded: true,
                        multiline: false,
                        dontGenerate: false,
                        placeholder: "dosageplaceholder",
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "default",
                        },
                      },
                      {
                        title: "medication notes",
                        id: "notes",
                        value: {
                          string: "multiple times a day",
                        },
                        guarded: true,
                        multiline: true,
                        dontGenerate: false,
                        placeholder: "notesplaceholder",
                        inputTraits: {
                          keyboard: "default",
                          correction: "default",
                          capitalization: "sentences",
                        },
                      },
                    ],
                  },
                ],
                passwordHistory: [],
              },
              overview: {
                subtitle: "2022-01-01",
                title: "Some Health Record",
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
