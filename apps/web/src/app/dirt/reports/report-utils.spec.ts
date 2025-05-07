import * as papa from "papaparse";

jest.mock("papaparse", () => ({
  unparse: jest.fn(),
}));
import { collectProperty, exportToCSV, getUniqueItems, sumValue } from "./report-utils";

describe("getUniqueItems", () => {
  it("should return unique items based on a specified key", () => {
    const items = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
      { id: 1, name: "Item 1 Duplicate" },
    ];

    const uniqueItems = getUniqueItems(items, (item) => item.id);

    expect(uniqueItems).toEqual([
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ]);
  });

  it("should return an empty array when input is empty", () => {
    const items: { id: number; name: string }[] = [];

    const uniqueItems = getUniqueItems(items, (item) => item.id);

    expect(uniqueItems).toEqual([]);
  });
});

describe("sumValue", () => {
  it("should return the sum of all values of a specified property", () => {
    const items = [{ value: 10 }, { value: 20 }, { value: 30 }];

    const sum = sumValue(items, (item) => item.value);

    expect(sum).toBe(60);
  });

  it("should return 0 when input is empty", () => {
    const items: { value: number }[] = [];

    const sum = sumValue(items, (item) => item.value);

    expect(sum).toBe(0);
  });

  it("should handle negative numbers", () => {
    const items = [{ value: -10 }, { value: 20 }, { value: -5 }];

    const sum = sumValue(items, (item) => item.value);

    expect(sum).toBe(5);
  });
});

describe("collectProperty", () => {
  it("should collect a specified property from an array of objects", () => {
    const items = [{ values: [1, 2, 3] }, { values: [4, 5, 6] }];

    const aggregated = collectProperty(items, "values");

    expect(aggregated).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("should return an empty array when input is empty", () => {
    const items: { values: number[] }[] = [];

    const aggregated = collectProperty(items, "values");

    expect(aggregated).toEqual([]);
  });

  it("should handle objects with empty arrays as properties", () => {
    const items = [{ values: [] }, { values: [4, 5, 6] }];

    const aggregated = collectProperty(items, "values");

    expect(aggregated).toEqual([4, 5, 6]);
  });
});

describe("exportToCSV", () => {
  const data = [
    {
      email: "john@example.com",
      name: "John Doe",
      twoFactorEnabled: "On",
      accountRecoveryEnabled: "Off",
    },
    {
      email: "jane@example.com",
      name: "Jane Doe",
      twoFactorEnabled: "On",
      accountRecoveryEnabled: "Off",
    },
  ];
  test("exportToCSV should correctly export data to CSV format", () => {
    const mockExportData = [
      { id: "1", name: "Alice", email: "alice@example.com" },
      { id: "2", name: "Bob", email: "bob@example.com" },
    ];
    const mockedCsvOutput = "mocked CSV output";
    (papa.unparse as jest.Mock).mockReturnValue(mockedCsvOutput);

    exportToCSV(mockExportData);

    const csvOutput = papa.unparse(mockExportData);
    expect(csvOutput).toMatch(mockedCsvOutput);
  });

  it("should map data according to the headers and export to CSV", () => {
    const headers = {
      email: "Email Address",
      name: "Full Name",
      twoFactorEnabled: "Two-Step Login",
      accountRecoveryEnabled: "Account Recovery",
    };

    exportToCSV(data, headers);

    const expectedMappedData = [
      {
        "Email Address": "john@example.com",
        "Full Name": "John Doe",
        "Two-Step Login": "On",
        "Account Recovery": "Off",
      },
      {
        "Email Address": "jane@example.com",
        "Full Name": "Jane Doe",
        "Two-Step Login": "On",
        "Account Recovery": "Off",
      },
    ];

    expect(papa.unparse).toHaveBeenCalledWith(expectedMappedData);
  });

  it("should use original keys if headers are not provided", () => {
    exportToCSV(data);

    const expectedMappedData = [
      {
        email: "john@example.com",
        name: "John Doe",
        twoFactorEnabled: "On",
        accountRecoveryEnabled: "Off",
      },
      {
        email: "jane@example.com",
        name: "Jane Doe",
        twoFactorEnabled: "On",
        accountRecoveryEnabled: "Off",
      },
    ];

    expect(papa.unparse).toHaveBeenCalledWith(expectedMappedData);
  });

  it("should mix original keys if headers are not fully provided", () => {
    const headers = {
      email: "Email Address",
    };

    exportToCSV(data, headers);

    const expectedMappedData = [
      {
        "Email Address": "john@example.com",
        name: "John Doe",
        twoFactorEnabled: "On",
        accountRecoveryEnabled: "Off",
      },
      {
        "Email Address": "jane@example.com",
        name: "Jane Doe",
        twoFactorEnabled: "On",
        accountRecoveryEnabled: "Off",
      },
    ];

    expect(papa.unparse).toHaveBeenCalledWith(expectedMappedData);
  });
});
