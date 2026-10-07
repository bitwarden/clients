import { isOpenShellLoopbackBind, openShellForwardUrl } from "./openshell-ports";

describe("openshell-ports contract", () => {
  it("builds only a loopback http URL for a valid port", () => {
    expect(openShellForwardUrl(8080)).toBe("http://localhost:8080");
    expect(openShellForwardUrl(1)).toBe("http://localhost:1");
    expect(openShellForwardUrl(65535)).toBe("http://localhost:65535");
  });

  it.each([0, 65536, -1, 1.5, NaN, "80" as unknown as number])("rejects port %p", (port) => {
    expect(openShellForwardUrl(port)).toBeNull();
  });

  it("recognises loopback binds and treats anything else as exposed", () => {
    for (const address of ["127.0.0.1", "localhost", "LOCALHOST", "::1", ""]) {
      expect(isOpenShellLoopbackBind(address)).toBe(true);
    }
    for (const address of ["0.0.0.0", "192.168.1.5", "::"]) {
      expect(isOpenShellLoopbackBind(address)).toBe(false);
    }
  });
});
