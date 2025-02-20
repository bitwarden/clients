import { ProtonPassJsonFile } from "../../protonpass/types/protonpass-json-type";

export const testData: ProtonPassJsonFile = {
  version: "1.21.2",
  userId: "REDACTED_USER_ID",
  encrypted: false,
  vaults: {
    REDACTED_VAULT_ID_A: {
      name: "Personal",
      description: "Personal vault",
      display: {
        color: 0,
        icon: 0,
      },
      items: [
        {
          itemId:
            "yZENmDjtmZGODNy3Q_CZiPAF_IgINq8w-R-qazrOh-Nt9YJeVF3gu07ovzDS4jhYHoMdOebTw5JkYPGgIL1mwQ==",
          shareId:
            "SN5uWo4WZF2uT5wIDqtbdpkjuxCbNTOIdf-JQ_DYZcKYKURHiZB5csS1a1p9lklvju9ni42l08IKzwQG0B2ySg==",
          data: {
            metadata: {
              name: "Test Login - Personal Vault",
              note: "My login secure note.",
              itemUuid: "e8ee1a0c",
            },
            extraFields: [
              {
                fieldName: "non-hidden field",
                type: "text",
                data: {
                  content: "non-hidden field content",
                },
              },
              {
                fieldName: "hidden field",
                type: "hidden",
                data: {
                  content: "hidden field content",
                },
              },
              {
                fieldName: "second 2fa secret",
                type: "totp",
                data: {
                  totpUri: "TOTPCODE",
                },
              },
            ],
            type: "login",
            content: {
              itemEmail: "Email",
              password: "Password",
              urls: ["https://example.com/", "https://example2.com/"],
              totpUri:
                "otpauth://totp/Test%20Login%20-%20Personal%20Vault:Username?issuer=Test%20Login%20-%20Personal%20Vault&secret=TOTPCODE&algorithm=SHA1&digits=6&period=30",
              passkeys: [],
              itemUsername: "Username",
            },
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 1,
          createTime: 1689182868,
          modifyTime: 1689182868,
          pinned: true,
        },
        {
          itemId:
            "xqq_Bh8RxNMBerkiMvRdH427yswZznjYwps-f6C5D8tmKiPgMxCSPNz1BOd4nRJ309gciDiPhXcCVWOyfJ66ZA==",
          shareId:
            "SN5uWo4WZF2uT5wIDqtbdpkjuxCbNTOIdf-JQ_DYZcKYKURHiZB5csS1a1p9lklvju9ni42l08IKzwQG0B2ySg==",
          data: {
            metadata: {
              name: "My Secure Note",
              note: "Secure note contents.",
              itemUuid: "ad618070",
            },
            extraFields: [],
            type: "note",
            content: {},
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 1,
          createTime: 1689182908,
          modifyTime: 1689182908,
          pinned: false,
        },
        {
          itemId:
            "ZmGzd-HNQYTr6wmfWlSfiStXQLqGic_PYB2Q2T_hmuRM2JIA4pKAPJcmFafxJrDpXxLZ2EPjgD6Noc9a0U6AVQ==",
          shareId:
            "SN5uWo4WZF2uT5wIDqtbdpkjuxCbNTOIdf-JQ_DYZcKYKURHiZB5csS1a1p9lklvju9ni42l08IKzwQG0B2ySg==",
          data: {
            metadata: {
              name: "Test Card",
              note: "Credit Card Note",
              itemUuid: "d8f45370",
            },
            extraFields: [],
            type: "creditCard",
            content: {
              cardholderName: "Test name",
              cardType: 0,
              number: "1234222233334444",
              verificationNumber: "333",
              expirationDate: "2025-01",
              pin: "1234",
            },
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 1,
          createTime: 1691001643,
          modifyTime: 1691001643,
          pinned: true,
        },
        {
          itemId:
            "xqq_Bh8RxNMBerkiMvRdH427yswZznjYwps-f6C5D8tmKiPgMxCSPNz1BOd4nRJ309gciDiPhXcCVWOyfJ66ZA==",
          shareId:
            "SN5uWo4WZF2uT5wIDqtbdpkjuxCbNTOIdf-JQ_DYZcKYKURHiZB5csS1a1p9lklvju9ni42l08IKzwQG0B2ySg==",
          data: {
            metadata: {
              name: "My Deleted Note",
              note: "Secure note contents.",
              itemUuid: "ad618070",
            },
            extraFields: [],
            type: "note",
            content: {},
          },
          state: 2,
          aliasEmail: null,
          contentFormatVersion: 1,
          createTime: 1689182908,
          modifyTime: 1689182908,
          pinned: false,
        },
        {
          itemId:
            "gliCOyyJOsoBf5QIijvCF4QsPij3q_MR4nCXZ2sXm7YCJCfHjrRD_p2XG9vLsaytErsQvMhcLISVS7q8-7SCkg==",
          shareId:
            "TpawpLbs1nuUlQUCtgKZgb3zgAvbrGrOaqOylKqVe_RLROEyUvMq8_ZEuGw73PGRUSr89iNtQ2NosuggP54nwA==",
          data: {
            metadata: {
              name: "Identity",
              note: "",
              itemUuid: "c2e52768",
            },
            extraFields: [
              {
                fieldName: "TestExtra",
                type: "text",
                data: {
                  content: "Extra",
                },
              },
            ],
            type: "identity",
            content: {
              fullName: "Test 1",
              email: "test@gmail.com",
              phoneNumber: "7507951789",
              firstName: "Test",
              middleName: "1",
              lastName: "Test",
              birthdate: "",
              gender: "Male",
              extraPersonalDetails: [
                {
                  fieldName: "TestPersonal",
                  type: "text",
                  data: {
                    content: "Personal",
                  },
                },
              ],
              organization: "Bitwarden",
              streetAddress: "23 Street",
              zipOrPostalCode: "4038456",
              city: "New York",
              stateOrProvince: "Test",
              countryOrRegion: "US",
              floor: "12th Foor",
              county: "Test County",
              extraAddressDetails: [
                {
                  fieldName: "TestAddress",
                  type: "text",
                  data: {
                    content: "Address",
                  },
                },
              ],
              socialSecurityNumber: "98378264782",
              passportNumber: "7173716378612",
              licenseNumber: "21234",
              website: "",
              xHandle: "@twiter",
              secondPhoneNumber: "243538978",
              linkedin: "",
              reddit: "",
              facebook: "",
              yahoo: "",
              instagram: "@insta",
              extraContactDetails: [
                {
                  fieldName: "TestContact",
                  type: "hidden",
                  data: {
                    content: "Contact",
                  },
                },
              ],
              company: "Bitwarden",
              jobTitle: "Engineer",
              personalWebsite: "",
              workPhoneNumber: "78236476238746",
              workEmail: "",
              extraWorkDetails: [
                {
                  fieldName: "TestWork",
                  type: "hidden",
                  data: {
                    content: "Work",
                  },
                },
              ],
              extraSections: [
                {
                  sectionName: "TestSection",
                  sectionFields: [
                    {
                      fieldName: "TestSection",
                      type: "text",
                      data: {
                        content: "Section",
                      },
                    },
                    {
                      fieldName: "TestSectionHidden",
                      type: "hidden",
                      data: {
                        content: "SectionHidden",
                      },
                    },
                  ],
                },
              ],
            },
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 6,
          createTime: 1725707298,
          modifyTime: 1725707298,
          pinned: false,
        },
        {
          itemId:
            "WTKLZtKfHIC3Gv7gRXUANifNjj0gN3P_52I4MznAzig9GSb_OgJ0qcZ8taOZyfsFTLOWBslXwI-HSMWXVmnKzQ==",
          shareId:
            "TpawpLbs1nuUlQUCtgKZgb3zgAvbrGrOaqOylKqVe_RLROEyUvMq8_ZEuGw73PGRUSr89iNtQ2NosuggP54nwA==",
          data: {
            metadata: { name: "Alias", note: "", itemUuid: "576f14fa" },
            extraFields: [],
            type: "alias",
            content: {},
          },
          state: 1,
          aliasEmail: "alias.removing005@passinbox.com",
          contentFormatVersion: 6,
          createTime: 1725708208,
          modifyTime: 1725708208,
          pinned: false,
        },
      ],
    },
    REDACTED_VAULT_ID_B: {
      name: "Test",
      description: "",
      display: {
        color: 4,
        icon: 2,
      },
      items: [
        {
          itemId:
            "U_J8-eUR15sC-PjUhjVcixDcayhjGuoerUZCr560RlAi0ZjBNkSaSKAytVzZn4E0hiFX1_y4qZbUetl6jO3aJw==",
          shareId:
            "OJz-4MnPqAuYnyemhctcGDlSLJrzsTnf2FnFSwxh1QP_oth9xyGDc2ZAqCv5FnqkVgTNHT5aPj62zcekNemfNw==",
          data: {
            metadata: {
              name: "Other vault login",
              note: "",
              itemUuid: "f3429d44",
            },
            extraFields: [],
            type: "login",
            content: {
              itemEmail: "other vault username",
              password: "other vault password",
              urls: [],
              totpUri: "JBSWY3DPEHPK3PXP",
              passkeys: [],
              itemUsername: "",
            },
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 1,
          createTime: 1689182949,
          modifyTime: 1689182949,
          pinned: false,
        },
      ],
    },
  },
};
