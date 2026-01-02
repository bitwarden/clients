import { USER_EVER_HAD_USER_KEY } from "./user-key.state";

describe("Ever had user key", () => {
  const sut = USER_EVER_HAD_USER_KEY;

  it("should deserialize ever had user key", () => {
    const everHadUserKey = true;

    const result = sut.deserializer(JSON.parse(JSON.stringify(everHadUserKey)));

    expect(result).toEqual(everHadUserKey);
  });
});
