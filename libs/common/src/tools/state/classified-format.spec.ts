import { isClassifiedFormat } from "./classified-format";

describe("isClassifiedFormat", () => {
  it("returns `false` when the argument is `null`", () => {
    expect(isClassifiedFormat(null)).toEqual(false);
  });

  it.each([
    [{ id: true, secret: "" }],
    [{ secret: "", disclosed: {} }],
    [{ id: true, disclosed: {} }],
  ])("returns `false` when the argument is missing a required member (=%p).", (value) => {
    expect(isClassifiedFormat(value)).toEqual(false);
  });

  it("returns `false` when 'secret' is not a string", () => {
    expect(isClassifiedFormat({ id: true, secret: false, disclosed: {} })).toEqual(false);
  });

  it("returns `false` when 'disclosed' is not an object", () => {
    expect(isClassifiedFormat({ id: true, secret: "", disclosed: false })).toEqual(false);
  });

  it("returns `true` when the argument has a `secret`, `disclosed`, and `id`.", () => {
    expect(isClassifiedFormat({ id: true, secret: "", disclosed: {} })).toEqual(true);
  });
});
