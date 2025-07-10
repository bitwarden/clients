import { StateConstraints } from "../types";

import { isDynamic } from "./state-constraints-dependency";

type TestType = { foo: string };

describe("isDynamic", () => {
  it("returns `true` when the constraint fits the `DynamicStateConstraints` type.", () => {
    const constraint: any = {
      calibrate(state: TestType): StateConstraints<TestType> {
        return null;
      },
    };

    const result = isDynamic(constraint);

    expect(result).toBeTruthy();
  });

  it("returns `false` when the constraint fails to fit the `DynamicStateConstraints` type.", () => {
    const constraint: any = {};

    const result = isDynamic(constraint);

    expect(result).toBeFalsy();
  });
});
