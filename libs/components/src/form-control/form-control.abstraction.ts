export abstract class BitFormControlAbstraction {
  abstract disabled: boolean | null;
  abstract required: boolean;
  abstract hasError: boolean;
  abstract error: [string, any];
}
