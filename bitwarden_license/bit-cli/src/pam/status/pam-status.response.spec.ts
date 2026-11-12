import { PamCollectionResponse } from "./pam-status.response";

describe("PamCollectionResponse", () => {
  it("strips control characters from the collection name", () => {
    const response = new PamCollectionResponse({
      id: "col",
      organizationId: "o",
      name: "Prod\u001b[2K\r\u001b[31mfake\u202e row\u0007",
      hasEnabledAccessRule: true,
    });
    expect(response.name).toBe("Prod[2K [31mfake row");
    expect(JSON.stringify(response)).not.toMatch(/[\p{Cc}\u202e]/u);
  });
});
