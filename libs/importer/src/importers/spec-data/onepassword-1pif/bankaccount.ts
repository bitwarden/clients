export const BankAccountTestData =
  JSON.stringify({
    uuid: "5mkncrg6y5ujnumc3zpv7qf2lu",
    updatedAt: 1780951297,
    securityLevel: "SL5",
    contentsHash: "5386923",
    title: "Test Bank Account",
    secureContents: {
      branchAddress: "1 Main Street, Bree, Bree-hill, Eriador",
      bankName: "Bank of the Shire",
      accountNo: "1234567890",
      branchPhone: "1112223333",
      sections: [
        {
          fields: [
            {
              k: "string",
              v: "Bank of the Shire",
              n: "bankName",
              inputTraits: {
                autocapitalization: "Words",
              },
              t: "bank name",
            },
            {
              k: "string",
              n: "owner",
              inputTraits: {
                autocapitalization: "Words",
              },
              t: "owner",
              v: "Bilbo Baggins",
            },
            {
              k: "menu",
              n: "accountType",
              t: "account type",
              v: "Checking",
            },
            {
              k: "string",
              n: "routingNo",
              inputTraits: {
                keyboard: "NumbersAndPunctuation",
              },
              t: "routing number",
              v: "12345",
            },
            {
              k: "string",
              v: "1234567890",
              n: "accountNo",
              inputTraits: {
                keyboard: "NumbersAndPunctuation",
              },
              t: "account number",
            },
            {
              k: "string",
              v: "123",
              n: "swift",
              inputTraits: {
                keyboard: "NumbersAndPunctuation",
              },
              t: "SWIFT",
            },
            {
              k: "string",
              n: "iban",
              t: "IBAN",
              v: "1234",
            },
            {
              k: "concealed",
              inputTraits: {
                keyboard: "NumberPad",
              },
              n: "telephonePin",
              a: {
                generate: "off",
              },
              t: "Telephone PIN",
              v: "1111",
            },
          ],
          title: "",
          name: "",
        },
        {
          fields: [
            {
              k: "phone",
              v: "1112223333",
              n: "branchPhone",
              inputTraits: {
                keyboard: "NamePhonePad",
              },
              t: "phone",
            },
            {
              k: "string",
              v: "1 Main Street, Bree, Bree-hill, Eriador",
              n: "branchAddress",
              inputTraits: {
                autocapitalization: "Sentences",
              },
              t: "address",
            },
          ],
          title: "Branch Information",
          name: "branchInfo",
        },
      ],
      swift: "123",
    },
    createdAt: 1780951283,
    typeName: "wallet.financial.BankAccountUS",
  }) + "\n***aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee***";
