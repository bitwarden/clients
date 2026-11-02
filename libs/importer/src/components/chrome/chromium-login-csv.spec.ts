import { chromiumLoginsToCsv } from "./chromium-login-csv";

describe("chromiumLoginsToCsv", () => {
  it("converts successful logins into a CSV matching ChromeCsvImporter's expected columns", () => {
    const result = chromiumLoginsToCsv([
      {
        login: {
          url: "https://example.com",
          username: "alice",
          password: "hunter2",
          note: "",
        },
      },
    ]);

    expect(result).toEqual({
      csv: expect.stringContaining("example.com,https://example.com,alice,hunter2"),
    });
  });

  it("falls back to the raw url as the name when it isn't a parseable url", () => {
    const result = chromiumLoginsToCsv([
      { login: { url: "not-a-url", username: "alice", password: "hunter2", note: "" } },
    ]);

    expect(result).toEqual({
      csv: expect.stringContaining("not-a-url,not-a-url,alice,hunter2"),
    });
  });

  it("skips entries with no login (already-failed entries filtered elsewhere)", () => {
    const result = chromiumLoginsToCsv([
      { login: { url: "https://example.com", username: "alice", password: "hunter2", note: "" } },
      { login: undefined },
    ]);

    expect(result).toEqual({
      csv: expect.stringContaining("example.com"),
    });
  });

  it("returns errorOccurred with the failure detail when any record has a failure", () => {
    const result = chromiumLoginsToCsv([
      { login: { url: "https://example.com", username: "alice", password: "hunter2", note: "" } },
      { failure: { url: "https://broken.com", username: "bob", error: "v3 encryption" } },
    ]);

    expect(result).toEqual({ errorKey: "errorOccurred", failureDetail: "v3 encryption" });
  });

  it("returns importNothingError when there are no logins at all", () => {
    expect(chromiumLoginsToCsv([])).toEqual({ errorKey: "importNothingError" });
  });

  it("returns importNothingError, not a false success, when every record has neither login nor failure", () => {
    // logins.length === 0 alone would miss this: non-empty, but nothing importable.
    const result = chromiumLoginsToCsv([{}, {}]);

    expect(result).toEqual({ errorKey: "importNothingError" });
  });
});
