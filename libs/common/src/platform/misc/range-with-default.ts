/**
 * A range with a default value.
 *
 * Enforces constraints to ensure min > default > max.
 */
export class RangeWithDefault {
  constructor(
    readonly min: number,
    readonly max: number,
    readonly defaultValue: number,
  ) {
    if (min > max) {
      throw new Error(`${min} is greater than ${max}.`);
    }

    if (this.inRange(defaultValue) === false) {
      throw new Error("Default value is not in range.");
    }
  }

  inRange(value: number): boolean {
    return value >= this.min && value <= this.max;
  }
}
