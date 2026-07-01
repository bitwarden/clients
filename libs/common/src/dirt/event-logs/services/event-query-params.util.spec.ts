import { addEventParameters } from "./event-query-params.util";

describe("addEventParameters", () => {
  const base = "/organizations/org-1/sends/send-1/events";

  it("returns the base unchanged when all parameters are null", () => {
    expect(addEventParameters(base, null, null, null)).toBe(base);
  });

  it("appends start as the first query parameter", () => {
    expect(addEventParameters(base, "2024-01-01", null, null)).toBe(`${base}?start=2024-01-01`);
  });

  it("appends end with ? when start is absent and & when present", () => {
    expect(addEventParameters(base, null, "2024-01-31", null)).toBe(`${base}?end=2024-01-31`);
    expect(addEventParameters(base, "2024-01-01", "2024-01-31", null)).toBe(
      `${base}?start=2024-01-01&end=2024-01-31`,
    );
  });

  it("appends the continuation token, joining with ? or & as appropriate", () => {
    expect(addEventParameters(base, null, null, "tok-1")).toBe(`${base}?continuationToken=tok-1`);
    expect(addEventParameters(base, "2024-01-01", "2024-01-31", "tok-1")).toBe(
      `${base}?start=2024-01-01&end=2024-01-31&continuationToken=tok-1`,
    );
  });
});
