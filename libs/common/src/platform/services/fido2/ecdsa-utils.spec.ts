import { p1363ToDer } from "./ecdsa-utils";

describe("p1363ToDer", () => {
  let r: Uint8Array;
  let s: Uint8Array;

  beforeEach(() => {
    r = randomBytes(32);
    s = randomBytes(32);
  });

  it("should convert P1336 to DER when 'R' is positive and 'S' is positive", () => {
    r[0] = 0x14;
    s[0] = 0x32;
    const signature = new Uint8Array([...r, ...s]);

    const result = p1363ToDer(signature);

    expect(result).toEqual(new Uint8Array([0x30, 0x44, 0x02, 0x20, ...r, 0x02, 0x20, ...s]));
  });

  it("should convert P1336 to DER when 'R' is negative and 'S' is negative", () => {
    r[0] = 0x94;
    s[0] = 0xaa;
    const signature = new Uint8Array([...r, ...s]);

    const result = p1363ToDer(signature);

    expect(result).toEqual(
      new Uint8Array([0x30, 0x46, 0x02, 0x21, 0x00, ...r, 0x02, 0x21, 0x00, ...s]),
    );
  });

  it("should convert P1336 to DER when 'R' is negative and 'S' is positive", () => {
    r[0] = 0x94;
    s[0] = 0x32;
    const signature = new Uint8Array([...r, ...s]);

    const result = p1363ToDer(signature);

    expect(result).toEqual(new Uint8Array([0x30, 0x45, 0x02, 0x21, 0x00, ...r, 0x02, 0x20, ...s]));
  });

  it("should convert P1336 to DER when 'R' is positive and 'S' is negative", () => {
    r[0] = 0x32;
    s[0] = 0x94;
    const signature = new Uint8Array([...r, ...s]);

    const result = p1363ToDer(signature);

    expect(result).toEqual(new Uint8Array([0x30, 0x45, 0x02, 0x20, ...r, 0x02, 0x21, 0x00, ...s]));
  });

  it("should convert P1336 to DER when 'R' has leading zero and is negative and 'S' is positive", () => {
    r[0] = 0x00;
    r[1] = 0x94;
    s[0] = 0x32;
    const signature = new Uint8Array([...r, ...s]);

    const result = p1363ToDer(signature);

    expect(result).toEqual(
      new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x00, ...r.slice(1), 0x02, 0x20, ...s]),
    );
  });

  it("should convert P1336 to DER when 'R' is positive and 'S' has leading zero and is negative ", () => {
    r[0] = 0x32;
    s[0] = 0x00;
    s[1] = 0x94;
    const signature = new Uint8Array([...r, ...s]);

    const result = p1363ToDer(signature);

    expect(result).toEqual(
      new Uint8Array([0x30, 0x44, 0x02, 0x20, ...r, 0x02, 0x20, 0x00, ...s.slice(1)]),
    );
  });
});

function randomBytes(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}
