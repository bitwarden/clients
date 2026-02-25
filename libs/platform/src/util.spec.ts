import { urlOriginsMatch } from "./util";

describe("urlOriginsMatch", () => {
  it.each([
    ["string/string, same origin", "https://example.com", "https://example.com"],
    ["URL/URL, same origin", new URL("https://example.com"), new URL("https://example.com")],
    ["string canonical, URL suspect", "https://example.com", new URL("https://example.com/path")],
    ["URL canonical, string suspect", new URL("https://example.com/path"), "https://example.com"],
    [
      "paths and query differ but origin same",
      "https://example.com/foo",
      "https://example.com/bar?baz=1",
    ],
    ["explicit default port matches implicit", "https://example.com", "https://example.com:443"],
    [
      "non-special scheme with matching host",
      "chrome-extension://abc123/popup.html",
      "chrome-extension://abc123/bg.js",
    ],
    [
      "safari extension GUID uppercase in suspect",
      "safari-web-extension://d8726ae3-f81f-4d3a-85a0-64c2cb453e39/",
      "safari-web-extension://D8726AE3-F81F-4D3A-85A0-64C2CB453E39/",
    ],
    [
      "safari extension GUID uppercase in canonical",
      "safari-web-extension://D8726AE3-F81F-4D3A-85A0-64C2CB453E39/",
      "safari-web-extension://d8726ae3-f81f-4d3a-85a0-64c2cb453e39/",
    ],
    [
      "safari extension GUID uppercase on both sides",
      "safari-web-extension://D8726AE3-F81F-4D3A-85A0-64C2CB453E39/popup.html",
      "safari-web-extension://D8726AE3-F81F-4D3A-85A0-64C2CB453E39/bg.js",
    ],
  ])("returns true when %s", (_, canonical, suspect) => {
    expect(urlOriginsMatch(canonical as string | URL, suspect as string | URL)).toBe(true);
  });

  it.each([
    ["hosts differ", "https://example.com", "https://evil.com"],
    ["schemes differ", "https://example.com", "http://example.com"],
    ["ports differ", "https://example.com:8080", "https://example.com:9090"],
    [
      "suspect is a subdomain of the canonical host",
      "https://example.com",
      "https://sub.example.com",
    ],
    ["non-special scheme hosts differ", "chrome-extension://abc123/", "chrome-extension://xyz789/"],
    [
      "safari extension GUIDs differ (mixed case)",
      "safari-web-extension://D8726AE3-F81F-4D3A-85A0-64C2CB453E39/",
      "safari-web-extension://AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE/",
    ],
  ])("returns false when %s", (_, canonical, suspect) => {
    expect(urlOriginsMatch(canonical, suspect)).toBe(false);
  });

  it.each([
    ["canonical is an invalid string", "not a url", "https://example.com"],
    ["suspect is an invalid string", "https://example.com", "not a url"],
  ])("returns false when %s", (_, canonical, suspect) => {
    expect(urlOriginsMatch(canonical, suspect)).toBe(false);
  });

  it.each([
    ["canonical is a file: URL", "file:///home/user/a.txt", "https://example.com"],
    ["suspect is a file: URL", "https://example.com", "file:///home/user/a.txt"],
    ["both are file: URLs", "file:///home/user/a.txt", "file:///home/other/b.txt"],
    ["canonical is a data: URL", "data:text/plain,foo", "https://example.com"],
    ["suspect is a data: URL", "https://example.com", "data:text/plain,foo"],
  ])("returns false when %s (no host)", (_, canonical, suspect) => {
    expect(urlOriginsMatch(canonical, suspect)).toBe(false);
  });
});
