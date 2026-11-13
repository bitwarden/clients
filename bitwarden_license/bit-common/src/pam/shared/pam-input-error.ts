/**
 * A refusal of the operator's own input, raised before anything is sent. The message is written
 * by this code, never taken from the server or the vault, so it is always safe to print.
 */
export class PamInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PamInputError";
  }
}
