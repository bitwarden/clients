import { SyncResponse } from "./sync.response";

type SyncStatus = "Started" | "Completed";

type SyncEventArgsBase<T extends SyncStatus> = {
  status: T;
};

type SyncCompletedEventArgsBase<T extends boolean> = SyncEventArgsBase<"Completed"> & {
  successfully: T;
};

type SyncSuccessfullyCompletedEventArgs = SyncCompletedEventArgsBase<true> & {
  data: SyncResponse;
};

export type SyncEventArgs =
  | SyncSuccessfullyCompletedEventArgs
  | SyncCompletedEventArgsBase<false>
  | SyncEventArgsBase<"Started">;

/**
 * Helper function to filter only on successfully completed syncs
 * @returns a function that can be used in a `.pipe(filter(...))` from an observable
 * @example
 * ```
 * of<SyncEventArgs>({ status: "Completed", successfully: true, data: new SyncResponse() })
 *  .pipe(filter(isSuccessfullyCompleted))
 *  .subscribe(event => {
 *    console.log(event.data);
 *  });
 * ```
 */
export function isSuccessfullyCompleted(
  syncEvent: SyncEventArgs,
): syncEvent is SyncSuccessfullyCompletedEventArgs {
  return syncEvent.status === "Completed" && syncEvent.successfully;
}
