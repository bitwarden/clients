import { sanitizeUntrusted } from "./sanitize-untrusted";

describe("sanitizeUntrusted", () => {
  it("strips escape sequences' control characters", () => {
    expect(sanitizeUntrusted("ok\u001b[31mred\u0007")).toBe("ok[31mred");
  });

  it("turns line breaks and tabs into one space", () => {
    expect(sanitizeUntrusted("one\r\ntwo\tthree\n\nfour")).toBe("one two three four");
  });

  it("removes bidirectional overrides and zero-width characters", () => {
    expect(sanitizeUntrusted("a\u202Eb\u200Bc\uFEFFd")).toBe("abcd");
  });

  it("removes the Arabic letter mark, word joiner, invisible operators and Mongolian vowel separator", () => {
    expect(sanitizeUntrusted("a\u061Cb\u2060c\u2061d\u2062e\u2063f\u2064g\u180Eh")).toBe(
      "abcdefgh",
    );
  });

  it("truncates with an ellipsis at the limit", () => {
    expect(sanitizeUntrusted("abcdefghij", 5)).toBe("abcd…");
  });

  it("leaves text at the limit alone", () => {
    expect(sanitizeUntrusted("abcde", 5)).toBe("abcde");
  });

  it("truncates by character, not by UTF-16 unit", () => {
    expect(sanitizeUntrusted("😀😀😀😀", 3)).toBe("😀😀…");
  });

  it("answers an empty string for null and undefined", () => {
    expect(sanitizeUntrusted(null)).toBe("");
    expect(sanitizeUntrusted(undefined)).toBe("");
  });

  it("caps long text by default", () => {
    expect(Array.from(sanitizeUntrusted("x".repeat(1000))).length).toBe(200);
  });
});
