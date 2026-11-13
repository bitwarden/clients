/** How a 1Password sign-in in the window of the main process ended. */
export type OnePasswordSsoLoginOutcome =
  | { status: "redirected"; redirectedTo: string }
  /** The user closed the window. */
  | { status: "closed" }
  /** The renderer called the sign-in off, or went away. */
  | { status: "canceled" };
