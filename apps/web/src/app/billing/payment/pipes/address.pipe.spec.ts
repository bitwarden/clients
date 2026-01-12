import { AddressPipe } from "./address.pipe";

describe("AddressPipe", () => {
  let pipe: AddressPipe;

  beforeEach(() => {
    pipe = new AddressPipe();
  });

  it("should format a complete address with all fields", () => {
    const address = {
      country: "United States",
      postalCode: "10001",
      line1: "123 Main St",
      line2: "Apt 4B",
      city: "New York",
      state: "NY",
    };

    const result = pipe.transform(address);
    expect(result).toBe("123 Main St, Apt 4B, New York, NY, 10001, United States");
  });

  it("should format address without line2", () => {
    const address = {
      country: "United States",
      postalCode: "10001",
      line1: "123 Main St",
      line2: null,
      city: "New York",
      state: "NY",
    };

    const result = pipe.transform(address);
    expect(result).toBe("123 Main St, New York, NY, 10001, United States");
  });

  it("should format address without state", () => {
    const address = {
      country: "United Kingdom",
      postalCode: "SW1A 1AA",
      line1: "123 Main St",
      line2: "Apt 4B",
      city: "London",
      state: null,
    };

    const result = pipe.transform(address);
    expect(result).toBe("123 Main St, Apt 4B, London, SW1A 1AA, United Kingdom");
  });

  it("should format minimal address with only required fields", () => {
    const address = {
      country: "United States",
      postalCode: "10001",
      line1: null,
      line2: null,
      city: null,
      state: null,
    };

    const result = pipe.transform(address);
    expect(result).toBe("10001, United States");
  });
});
