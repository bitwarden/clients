import { SyncDownResponse } from "./generated/SyncDown";
import * as fixture from "./keeper-vault-fixture.json";

describe("Keeper Vault", () => {
  let response: SyncDownResponse;

  beforeAll(() => {
    const bytes = Buffer.from(fixture.response, "base64");
    response = SyncDownResponse.fromBinary(bytes);
  });

  it("should parse the protobuf response", () => {
    expect(response).toBeDefined();
  });

  it("should contain records", () => {
    expect(response.records.length).toBe(78);
  });

  it("should contain record metadata", () => {
    expect(response.recordMetaData.length).toBe(61);
  });

  it("should contain user folders", () => {
    expect(response.userFolders.length).toBe(8);
  });

  it("should contain shared folders", () => {
    expect(response.sharedFolders.length).toBe(9);
  });
});
