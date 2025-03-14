export const Type = Object.freeze({
  TimeOfDayRange: "TimeOfDayRange",
  DayOfWeek: "DayOfWeek",
  DayOfYear: "DayOfYear",
  Threshold: "Threshold",
  HasTag: "HasTag",
});

export const EvaluatorTypes = Object.freeze(Object.keys(Type) as ReadonlyArray<keyof typeof Type>);
