import { ProtonPassJsonFile } from "../../protonpass/types/protonpass-json-type";

export const testData: ProtonPassJsonFile = {
  version: "1.21.2",
  userId: "REDACTED_USER_ID",
  encrypted: false,
  vaults: {
    REDACTED_VAULT_ID_A: {
      name: "Tools Team Test Vault",
      description: "",
      display: {
        color: 6,
        icon: 20,
      },
      items: [
        {
          itemId:
            "_VgfFcUTZk5BweahoXCSBxAsLHOCUQzhsihHpLqHXKHTiBIFrWoXMrO8YMoAJ_LACKmrp-1NxWs4BOadyOs4Ow==",
          shareId:
            "UFSQJJT91uavfndSF0hCovvQz8gZm5NDx89qaqss5rLABpgPqz1UjhuCMmOUQtw59SHjVEc1EgLM1Y4NX7RE2Q==",
          data: {
            metadata: {
              name: "Test Bank Account",
              note: "",
              itemUuid: "d743c245",
            },
            extraFields: [
              {
                fieldName: "Bank Name",
                type: "text",
                data: {
                  content: "Bank of the Shire",
                },
              },
              {
                fieldName: "Account Number",
                type: "text",
                data: {
                  content: "1234567890",
                },
              },
              {
                fieldName: "Routing Number",
                type: "text",
                data: {
                  content: "123456",
                },
              },
              {
                fieldName: "Account Type",
                type: "text",
                data: {
                  content: "Checking",
                },
              },
              {
                fieldName: "IBAN",
                type: "hidden",
                data: {
                  content: "123456",
                },
              },
              {
                fieldName: "SWIFT/BIC",
                type: "text",
                data: {
                  content: "1234",
                },
              },
              {
                fieldName: "Holder Name",
                type: "text",
                data: {
                  content: "Bilbo Baggins",
                },
              },
            ],
            type: "custom",
            content: {
              sections: [],
            },
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 8,
          createTime: 1787665235,
          modifyTime: 1787665235,
          pinned: false,
        },
        {
          itemId:
            "rpe4EFGhDLlur2b46SfXuKujdkQSC9263T4MA08sGDPx0khFWlHfChXKSsMU0tJ0QtnymON5qx2j-nIZCczJcg==",
          shareId:
            "UFSQJJT91uavfndSF0hCovvQz8gZm5NDx89qaqss5rLABpgPqz1UjhuCMmOUQtw59SHjVEc1EgLM1Y4NX7RE2Q==",
          data: {
            metadata: {
              name: "Test Driver's License",
              note: "",
              itemUuid: "1a1a4a71",
            },
            extraFields: [
              {
                fieldName: "Full Name",
                type: "text",
                data: {
                  content: "Bilbo Baggins",
                },
              },
              {
                fieldName: "License Number",
                type: "text",
                data: {
                  content: "123456789",
                },
              },
              {
                fieldName: "Issuing State/Country",
                type: "text",
                data: {
                  content: "The Shire",
                },
              },
              {
                fieldName: "Expiry Date",
                type: "timestamp",
                data: {
                  timestamp: "2951-06-19",
                },
              },
              {
                fieldName: "Date of Birth",
                type: "timestamp",
                data: {
                  timestamp: "2890-09-22",
                },
              },
              {
                fieldName: "Class",
                type: "text",
                data: {
                  content: "D",
                },
              },
            ],
            type: "custom",
            content: {
              sections: [],
            },
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 8,
          createTime: 1787665310,
          modifyTime: 1787665310,
          pinned: false,
        },
        {
          itemId:
            "1VN0mUGGFDIg4EiMugcad0MJ34qEKNRQGsiOcRNplt6go2orCf0c2_i7vSLIO3oLnugSYeLa4UjzjyZ499m4sg==",
          shareId:
            "UFSQJJT91uavfndSF0hCovvQz8gZm5NDx89qaqss5rLABpgPqz1UjhuCMmOUQtw59SHjVEc1EgLM1Y4NX7RE2Q==",
          data: {
            metadata: {
              name: "Test Passport",
              note: "",
              itemUuid: "b7b1ead0",
            },
            extraFields: [
              {
                fieldName: "Full Name",
                type: "text",
                data: {
                  content: "Bilbo Baggins",
                },
              },
              {
                fieldName: "Passport Number",
                type: "hidden",
                data: {
                  content: "1234567890",
                },
              },
              {
                fieldName: "Country",
                type: "text",
                data: {
                  content: "The Shire",
                },
              },
              {
                fieldName: "Expiry Date",
                type: "timestamp",
                data: {
                  timestamp: "2951-06-19",
                },
              },
              {
                fieldName: "Date of Birth",
                type: "timestamp",
                data: {
                  timestamp: "2890-09-22",
                },
              },
              {
                fieldName: "Issuing Authority",
                type: "text",
                data: {
                  content: "Hobbiton Consulate",
                },
              },
            ],
            type: "custom",
            content: {
              sections: [],
            },
          },
          state: 1,
          aliasEmail: null,
          contentFormatVersion: 8,
          createTime: 1787665360,
          modifyTime: 1787665360,
          pinned: false,
        },
      ],
    },
  },
};
