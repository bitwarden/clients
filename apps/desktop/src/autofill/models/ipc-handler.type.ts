export type CompletionCallback<Response> = {
  (error: null, response: Response): void;
  (error: Error, response: null): void;
};
/**
 * A listener for an Autofill IPC channel. Invoked with the request payload and
 * an optional callback to return the response (or an error) to the Autofill
 * main process.
 */
export type IpcListener<Request, Response> = (
  clientId: number,
  sequenceNumber: number,
  request: Request,
  completeCallback?: CompletionCallback<Response>,
) => void;

/**
 * A function to bind a listener to an Autofill IPC channel. Should be one of
 * the `listen*` functions on {@link ipc.autofill}.
 */
export type IpcListenerBindFn<Request, Response> = (fn: IpcListener<Request, Response>) => void;
