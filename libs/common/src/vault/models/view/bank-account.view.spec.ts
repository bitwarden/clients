import { BankAccountView } from "./bank-account.view";

describe("BankAccountView", () => {
  describe("toSdkBankAccountView", () => {
    it("converts populated fields", () => {
      const bankAccountView = new BankAccountView();
      bankAccountView.bankName = "Bank of Bitwarden";
      bankAccountView.nameOnAccount = "Jane Doe";
      bankAccountView.accountType = "checking";
      bankAccountView.accountNumber = "1234567890";
      bankAccountView.routingNumber = "021000021";
      bankAccountView.branchNumber = "001";
      bankAccountView.pin = "4321";
      bankAccountView.swiftCode = "BOFAUS3N";
      bankAccountView.iban = "GB33BUKB20201555555555";
      bankAccountView.bankContactPhone = "555-0100";

      const result = bankAccountView.toSdkBankAccountView();

      expect(result).toEqual({
        bankName: "Bank of Bitwarden",
        nameOnAccount: "Jane Doe",
        accountType: "checking",
        accountNumber: "1234567890",
        routingNumber: "021000021",
        branchNumber: "001",
        pin: "4321",
        swiftCode: "BOFAUS3N",
        iban: "GB33BUKB20201555555555",
        bankContactPhone: "555-0100",
      });
    });

    it("converts empty strings to undefined", () => {
      const bankAccountView = new BankAccountView();
      bankAccountView.bankName = "";
      bankAccountView.nameOnAccount = "";
      bankAccountView.accountType = "";
      bankAccountView.accountNumber = "";
      bankAccountView.routingNumber = "";
      bankAccountView.branchNumber = "";
      bankAccountView.pin = "";
      bankAccountView.swiftCode = "";
      bankAccountView.iban = "";
      bankAccountView.bankContactPhone = "";

      const result = bankAccountView.toSdkBankAccountView();

      expect(result).toEqual({
        bankName: undefined,
        nameOnAccount: undefined,
        accountType: undefined,
        accountNumber: undefined,
        routingNumber: undefined,
        branchNumber: undefined,
        pin: undefined,
        swiftCode: undefined,
        iban: undefined,
        bankContactPhone: undefined,
      });
    });
  });
});
