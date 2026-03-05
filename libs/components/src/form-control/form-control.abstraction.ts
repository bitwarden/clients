export abstract class BitFormControlAbstraction {
  abstract disabled: boolean;
  abstract required: boolean;
  abstract hasError: boolean;
  abstract error: [string, any];
}
