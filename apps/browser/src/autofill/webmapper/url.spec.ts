import { parseUrl } from "./url";

describe("parseUrl", () => {
  it("returns root pathname for an https host without a path", () => {
    expect(parseUrl("https://example.com")).toEqual({
      host: "example.com",
      pathname: "/",
    });
  });

  it("supports http URLs", () => {
    expect(parseUrl("http://example.com/login")).toEqual({
      host: "example.com",
      pathname: "/login",
    });
  });

  it("strips www. from the host (canonical = non-www)", () => {
    expect(parseUrl("https://www.example.com/login")).toEqual({
      host: "example.com",
      pathname: "/login",
    });
  });

  it("does not strip non-www subdomains", () => {
    expect(parseUrl("https://login.example.com/x")).toEqual({
      host: "login.example.com",
      pathname: "/x",
    });
  });

  it("strips a trailing slash from non-root pathnames", () => {
    expect(parseUrl("https://example.com/login/")).toEqual({
      host: "example.com",
      pathname: "/login",
    });
  });

  it("keeps the root pathname as '/'", () => {
    expect(parseUrl("https://example.com/")).toEqual({
      host: "example.com",
      pathname: "/",
    });
  });

  it("keeps a non-default port in the host", () => {
    expect(parseUrl("https://example.com:8443/x")).toEqual({
      host: "example.com:8443",
      pathname: "/x",
    });
  });

  it("drops the default https port (URL.host already strips :443)", () => {
    expect(parseUrl("https://example.com:443/x")).toEqual({
      host: "example.com",
      pathname: "/x",
    });
  });

  it("rejects non-http(s) schemes", () => {
    expect(parseUrl("file:///foo")).toBeNull();
    expect(parseUrl("chrome://extensions")).toBeNull();
    expect(parseUrl("ftp://example.com")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(parseUrl("not a url")).toBeNull();
    expect(parseUrl("")).toBeNull();
  });

  it("ignores query and fragment in the pathname", () => {
    expect(parseUrl("https://example.com/login?next=/x#frag")).toEqual({
      host: "example.com",
      pathname: "/login",
    });
  });

  it("trims trailing slashes on nested pathnames", () => {
    expect(parseUrl("https://example.com/a/b/c/")).toEqual({
      host: "example.com",
      pathname: "/a/b/c",
    });
  });

  // Matches DomainSettingsService's `replace(/\/+$/, "")` so authored keys resolve.
  it("collapses multiple trailing slashes", () => {
    expect(parseUrl("https://example.com/login//")).toEqual({
      host: "example.com",
      pathname: "/login",
    });
  });
});
