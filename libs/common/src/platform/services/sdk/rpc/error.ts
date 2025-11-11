/**
 * RpcError represents an error that occurs during RPC communication.
 */
export class RpcError extends Error {
  constructor(message: string) {
    super(message);
  }
}
