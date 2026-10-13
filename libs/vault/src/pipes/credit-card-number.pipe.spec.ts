import { CreditCardNumberPipe } from "./credit-card-number.pipe";

describe("CreditCardNumberPipe", () => {
  let pipe: CreditCardNumberPipe;

  beforeEach(() => {
    pipe = new CreditCardNumberPipe();
  });

  it("formats a 16-digit card as 4-4-4-4", () => {
    expect(pipe.transform("4111111111111111", "Visa")).toBe("4111 1111 1111 1111");
  });

  it("formats a 15-digit Amex as 4-6-5", () => {
    expect(pipe.transform("378282246310005", "Amex")).toBe("3782 822463 10005");
  });

  it("formats a 14-digit Diners Club as 4-6-4", () => {
    expect(pipe.transform("36259600000004", "Diners Club")).toBe("3625 960000 0004");
  });

  it("formats a 19-digit UnionPay as 6-13", () => {
    expect(pipe.transform("6200000000000000003", "UnionPay")).toBe("620000 0000000000003");
  });

  it("falls back to Other format for unknown brands", () => {
    expect(pipe.transform("4111111111111111", "UnknownBrand")).toBe("4111 1111 1111 1111");
  });

  it("strips non-numeric characters before formatting", () => {
    expect(pipe.transform("4111-1111-1111-1111", "Visa")).toBe("4111 1111 1111 1111");
  });

  it("strips spaces before formatting", () => {
    expect(pipe.transform("4111 1111 1111 1111", "Visa")).toBe("4111 1111 1111 1111");
  });

  it("strips mixed non-numeric characters", () => {
    expect(pipe.transform("4111.1111/1111#1111", "Visa")).toBe("4111 1111 1111 1111");
  });

  it("appends remaining digits when number exceeds expected length", () => {
    expect(pipe.transform("41111111111111115555", "Visa")).toBe("4111 1111 1111 1111 5555");
  });

  it("handles a card number that is only non-numeric characters", () => {
    expect(pipe.transform("----", "Visa")).toBe("   ");
  });
});
