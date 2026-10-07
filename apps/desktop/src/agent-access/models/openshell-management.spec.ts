import {
  isOpenShellBinaryPath,
  isOpenShellDeniedEnvVarName,
  isOpenShellEndpointHost,
  isOpenShellImageReference,
  isOpenShellPort,
  isValidOpenShellPermission,
} from "./openshell-management";

describe("isOpenShellImageReference", () => {
  const digest = `sha256:${"a".repeat(64)}`;

  it.each([
    "ubuntu",
    "ubuntu:22.04",
    "library/ubuntu:latest",
    "ghcr.io/org/img:v1.2-rc_1",
    "localhost:5000/team/img",
    "registry.example.com:443/a/b/c:tag",
    `ghcr.io/org/img@${digest}`,
    `img:1@${digest}`,
  ])("accepts %s", (value) => {
    expect(isOpenShellImageReference(value)).toBe(true);
  });

  it.each([
    "/var/lib/rootfs",
    "./rootfs",
    ".hidden/img",
    "../escape",
    "a/../b",
    "a/./b",
    "img:1..2",
    "rootfs.tar",
    "images/base.tgz",
    "images/base.tar.gz",
    "images/Base.TAR",
    "ghcr.io/org/rootfs.tar:latest",
    "-flag",
    "--from=x",
    "Org/Img",
    "img:",
    "img@sha256:abc",
    "img with space",
    "imgé",
    "img\n",
    "a".repeat(255),
    "",
  ])("rejects %j", (value) => {
    expect(isOpenShellImageReference(value)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isOpenShellImageReference(undefined)).toBe(false);
    expect(isOpenShellImageReference(5)).toBe(false);
  });
});

describe("isOpenShellDeniedEnvVarName", () => {
  it.each([
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "DYLD_INSERT_LIBRARIES",
    "DYLD_LIBRARY_PATH",
    "NODE_OPTIONS",
    "NODE_PATH",
    "PATH",
    "HOME",
    "SHELL",
    "IFS",
    "BASH_ENV",
    "ENV",
    "PYTHONPATH",
    "PYTHONSTARTUP",
    "RUBYOPT",
    "PERL5OPT",
    "JAVA_TOOL_OPTIONS",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "http_proxy",
    "dyld_foo",
  ])("denies %s", (value) => {
    expect(isOpenShellDeniedEnvVarName(value)).toBe(true);
  });

  it.each(["GH_TOKEN", "API_KEY", "PATHOLOGY_TOKEN", "ENVIRONMENT", "MY_HOME"])(
    "allows %s",
    (value) => {
      expect(isOpenShellDeniedEnvVarName(value)).toBe(false);
    },
  );
});

describe("permission validators", () => {
  it.each([
    "api.github.com",
    "localhost",
    "*.example.com",
    "a",
    "10.0.0.1",
    "xn--bcher-kva.example",
  ])("accepts the host %s", (value) => {
    expect(isOpenShellEndpointHost(value)).toBe(true);
  });

  it.each([
    "*",
    "",
    "-a.com",
    "a.com-",
    "https://a.com",
    "a.com/path",
    "a.com:443",
    "a b.com",
    "*.*.com",
    "a".repeat(254),
    5,
    null,
  ])("rejects the host %p", (value) => {
    expect(isOpenShellEndpointHost(value)).toBe(false);
  });

  it.each([1, 443, 65535])("accepts port %d", (value) => {
    expect(isOpenShellPort(value)).toBe(true);
  });

  it.each([0, 65536, -1, 1.5, "443", NaN, null])("rejects port %p", (value) => {
    expect(isOpenShellPort(value)).toBe(false);
  });

  it.each(["/usr/bin/curl", "/opt/homebrew/bin/gh", "/"])("accepts the program %s", (value) => {
    expect(isOpenShellBinaryPath(value)).toBe(true);
  });

  it.each([
    "curl",
    "./curl",
    "/usr/../bin/curl",
    "/usr/bin/c url",
    "/usr/bin/a\nb",
    "/".padEnd(256, "a"),
    3,
  ])("rejects the program %p", (value) => {
    expect(isOpenShellBinaryPath(value)).toBe(false);
  });

  const endpoint = { host: "a.com", port: 443, access: "read-only" };

  it("needs at least one endpoint, valid access and valid programs", () => {
    expect(isValidOpenShellPermission([endpoint], [])).toBe(true);
    expect(isValidOpenShellPermission([endpoint], ["/usr/bin/curl"])).toBe(true);
    expect(isValidOpenShellPermission([], [])).toBe(false);
    expect(isValidOpenShellPermission([{ ...endpoint, access: "rw" }], [])).toBe(false);
    expect(isValidOpenShellPermission([endpoint, null], [])).toBe(false);
    expect(isValidOpenShellPermission([endpoint], ["curl"])).toBe(false);
    expect(isValidOpenShellPermission([endpoint], "/usr/bin/curl")).toBe(false);
    expect(isValidOpenShellPermission("x", [])).toBe(false);
  });

  it("caps endpoints at 50 and programs at 20", () => {
    expect(isValidOpenShellPermission(Array(51).fill(endpoint), [])).toBe(false);
    expect(isValidOpenShellPermission(Array(50).fill(endpoint), [])).toBe(true);
    expect(isValidOpenShellPermission([endpoint], Array(21).fill("/bin/x"))).toBe(false);
    expect(isValidOpenShellPermission([endpoint], Array(20).fill("/bin/x"))).toBe(true);
  });
});
