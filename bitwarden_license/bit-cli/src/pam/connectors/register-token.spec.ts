import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { PamInputError } from "@bitwarden/bit-common/pam/shared";

import { TokenFileReservation } from "./register-token";

describe("TokenFileReservation", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pam-token-spec-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("creates the file before the token exists and fills it later", () => {
    const file = path.join(dir, "t");
    const reservation = TokenFileReservation.reserve(file);
    expect(fs.readFileSync(file, "utf8")).toBe("");

    expect(reservation.write("abc")).toBe(true);
    expect(fs.readFileSync(file, "utf8")).toBe("abc");
  });

  it("never overwrites an existing file", () => {
    const file = path.join(dir, "t");
    fs.writeFileSync(file, "keep");

    expect(() => TokenFileReservation.reserve(file)).toThrow(PamInputError);
    expect(fs.readFileSync(file, "utf8")).toBe("keep");
  });

  it("refuses a missing folder without echoing the OS error", () => {
    expect(() => TokenFileReservation.reserve(path.join(dir, "no", "t"))).toThrow(
      "could not be created",
    );
  });

  it("removes the file on discard", () => {
    const file = path.join(dir, "t");
    TokenFileReservation.reserve(file).discard();
    expect(fs.existsSync(file)).toBe(false);
  });
});
