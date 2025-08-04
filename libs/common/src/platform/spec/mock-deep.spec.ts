import { mockDeep } from "./mock-deep";

class ToBeMocked {
  property = "value";

  method() {
    return "method";
  }

  sub() {
    return new SubToBeMocked();
  }
}

class SubToBeMocked {
  subProperty = "subValue";

  sub() {
    return new SubSubToBeMocked();
  }
}

class SubSubToBeMocked {
  subSubProperty = "subSubValue";
}

describe("deepMock", () => {
  it("can mock properties", () => {
    const mock = mockDeep<ToBeMocked>();
    mock.property.replaceProperty("mocked value");
    expect(mock.property).toBe("mocked value");
  });

  it("can mock methods", () => {
    const mock = mockDeep<ToBeMocked>();
    mock.method.mockReturnValue("mocked method");
    expect(mock.method()).toBe("mocked method");
  });

  it("can mock sub-properties", () => {
    const mock = mockDeep<ToBeMocked>();
    mock.sub.mockDeep().subProperty.replaceProperty("mocked sub value");
    expect(mock.sub().subProperty).toBe("mocked sub value");
  });

  it("can mock sub-sub-properties", () => {
    const mock = mockDeep<ToBeMocked>();
    mock.sub.mockDeep().sub.mockDeep().subSubProperty.replaceProperty("mocked sub-sub value");
    expect(mock.sub().sub().subSubProperty).toBe("mocked sub-sub value");
  });

  it("returns the same mock object when calling mockDeep multiple times", () => {
    const mock = mockDeep<ToBeMocked>();
    const subMock1 = mock.sub.mockDeep();
    const subMock2 = mock.sub.mockDeep();
    expect(subMock1).toBe(subMock2);
  });
});
