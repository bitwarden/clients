import { mockContainerService, mockEnc } from "../../../../spec";
import { BankAccountApi } from "../api/bank-account.api";
import { BankAccountData } from "../data/bank-account.data";

import { BankAccount } from "./bank-account";

describe("BankAccount", () => {
  let data: BankAccountData;

  beforeEach(() => {
    data = new BankAccountData(
      new BankAccountApi({
        BankName: "bankName",
        NameOnAccount: "nameOnAccount",
        AccountType: "accountType",
        AccountNumber: "accountNumber",
        RoutingNumber: "routingNumber",
        BranchNumber: "branchNumber",
        Pin: "pin",
        SwiftCode: "swiftCode",
        Iban: "iban",
        BankContactPhone: "bankContactPhone",
      }),
    );

    mockContainerService();
  });

  it("Convert", () => {
    const bankAccount = new BankAccount(data);

    expect(bankAccount).toEqual({
      bankName: { encryptedString: "bankName", encryptionType: 0 },
      nameOnAccount: { encryptedString: "nameOnAccount", encryptionType: 0 },
      accountType: { encryptedString: "accountType", encryptionType: 0 },
      accountNumber: { encryptedString: "accountNumber", encryptionType: 0 },
      routingNumber: { encryptedString: "routingNumber", encryptionType: 0 },
      branchNumber: { encryptedString: "branchNumber", encryptionType: 0 },
      pin: { encryptedString: "pin", encryptionType: 0 },
      swiftCode: { encryptedString: "swiftCode", encryptionType: 0 },
      iban: { encryptedString: "iban", encryptionType: 0 },
      bankContactPhone: { encryptedString: "bankContactPhone", encryptionType: 0 },
    });
  });

  it("Convert from empty", () => {
    const data = new BankAccountData();
    const bankAccount = new BankAccount(data);

    expect(bankAccount).toEqual({
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

    expect(data.bankName).toBeUndefined();
    expect(data.nameOnAccount).toBeUndefined();
    expect(data.accountType).toBeUndefined();
    expect(data.accountNumber).toBeUndefined();
    expect(data.routingNumber).toBeUndefined();
    expect(data.branchNumber).toBeUndefined();
    expect(data.pin).toBeUndefined();
    expect(data.swiftCode).toBeUndefined();
    expect(data.iban).toBeUndefined();
    expect(data.bankContactPhone).toBeUndefined();
  });

  it("toBankAccountData", () => {
    const bankAccount = new BankAccount(data);
    expect(bankAccount.toBankAccountData()).toEqual(data);
  });

  it("Decrypt", async () => {
    const bankAccount = Object.assign(new BankAccount(), {
      bankName: mockEnc("bankName"),
      nameOnAccount: mockEnc("nameOnAccount"),
      accountType: mockEnc("accountType"),
      accountNumber: mockEnc("accountNumber"),
      routingNumber: mockEnc("routingNumber"),
      branchNumber: mockEnc("branchNumber"),
      pin: mockEnc("pin"),
      swiftCode: mockEnc("swiftCode"),
      iban: mockEnc("iban"),
      bankContactPhone: mockEnc("bankContactPhone"),
    });
    const expectedView = {
      bankName: "bankName",
      nameOnAccount: "nameOnAccount",
      accountType: "accountType",
      accountNumber: "accountNumber",
      routingNumber: "routingNumber",
      branchNumber: "branchNumber",
      pin: "pin",
      swiftCode: "swiftCode",
      iban: "iban",
      bankContactPhone: "bankContactPhone",
    };

    const view = await bankAccount.decrypt(null);
    expect(view).toEqual(expectedView);
  });

  describe("fromJSON", () => {
    it("returns undefined if object is null", () => {
      expect(BankAccount.fromJSON(null)).toBeUndefined();
    });

    it("creates BankAccount instance from JSON object", () => {
      const jsonObj = {
        bankName: "2.bankName|encryptedData",
        nameOnAccount: "2.nameOnAccount|encryptedData",
        accountType: "2.accountType|encryptedData",
        accountNumber: "2.accountNumber|encryptedData",
        routingNumber: "2.routingNumber|encryptedData",
        branchNumber: "2.branchNumber|encryptedData",
        pin: "2.pin|encryptedData",
        swiftCode: "2.swiftCode|encryptedData",
        iban: "2.iban|encryptedData",
        bankContactPhone: "2.bankContactPhone|encryptedData",
      };

      const result = BankAccount.fromJSON(jsonObj)!;

      expect(result).toBeInstanceOf(BankAccount);
      expect(result.bankName).toBeDefined();
      expect(result.nameOnAccount).toBeDefined();
      expect(result.accountType).toBeDefined();
      expect(result.accountNumber).toBeDefined();
      expect(result.routingNumber).toBeDefined();
      expect(result.branchNumber).toBeDefined();
      expect(result.pin).toBeDefined();
      expect(result.swiftCode).toBeDefined();
      expect(result.iban).toBeDefined();
      expect(result.bankContactPhone).toBeDefined();
    });
  });

  describe("toSdkBankAccount", () => {
    it("should map to SDK BankAccount", () => {
      const bankAccount = new BankAccount(data);

      const sdkBankAccount = bankAccount.toSdkBankAccount();

      expect(sdkBankAccount).toEqual({
        bankName: "bankName",
        nameOnAccount: "nameOnAccount",
        accountType: "accountType",
        accountNumber: "accountNumber",
        routingNumber: "routingNumber",
        branchNumber: "branchNumber",
        pin: "pin",
        swiftCode: "swiftCode",
        iban: "iban",
        bankContactPhone: "bankContactPhone",
      });
    });
  });

  describe("fromSdkBankAccount", () => {
    it("returns undefined (stubbed)", () => {
      expect(BankAccount.fromSdkBankAccount(null)).toBeUndefined();
    });

    it("returns undefined for undefined input (stubbed)", () => {
      expect(BankAccount.fromSdkBankAccount(undefined)).toBeUndefined();
    });
  });
});
