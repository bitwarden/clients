import { BankAccountView } from "./bank-account.view";

describe("BankAccountView", () => {
  describe("toSdkBankAccountView", () => {
    it("should convert populated fields", () => {
      const bankAccountView = Object.assign(new BankAccountView(), {
        bankName: "Bank",
        nameOnAccount: "John Doe",
        accountType: "Checking",
        accountNumber: "123456789",
        routingNumber: "021000021",
        branchNumber: "001",
        pin: "1234",
        swiftCode: "BOFAUS3N",
        iban: "GB82WEST12345698765432",
        bankContactPhone: "555-555-5555",
      });

      const result = bankAccountView.toSdkBankAccountView();

      expect(result).toEqual({
        bankName: "Bank",
        nameOnAccount: "John Doe",
        accountType: "Checking",
        accountNumber: "123456789",
        routingNumber: "021000021",
        branchNumber: "001",
        pin: "1234",
        swiftCode: "BOFAUS3N",
        iban: "GB82WEST12345698765432",
        bankContactPhone: "555-555-5555",
      });
    });

    it("should convert empty strings to undefined", () => {
      const bankAccountView = Object.assign(new BankAccountView(), {
        bankName: "",
        nameOnAccount: "",
        accountType: "",
        accountNumber: "",
        routingNumber: "",
        branchNumber: "",
        pin: "",
        swiftCode: "",
        iban: "",
        bankContactPhone: "",
      });

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

    it("should only convert the empty fields to undefined", () => {
      const bankAccountView = Object.assign(new BankAccountView(), {
        bankName: "Bank",
        accountNumber: "",
        pin: "",
      });

      const result = bankAccountView.toSdkBankAccountView();

      expect(result.bankName).toBe("Bank");
      expect(result.accountNumber).toBeUndefined();
      expect(result.pin).toBeUndefined();
    });
  });
});
