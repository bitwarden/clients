type DerivedStateActions = "nextState" | "resolve";
type DerivedStateMessage = {
  id: string;
  action: DerivedStateActions;
  data?: string; // Json stringified TTo
  originator: "foreground" | "background";
};
