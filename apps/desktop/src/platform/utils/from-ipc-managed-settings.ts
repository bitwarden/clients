import { defer, fromEventPattern, merge } from "rxjs";

/**
 * @returns An observable that emits the current managed settings bag on subscribe,
 * then re-emits whenever the main process pushes an update.
 */
export const fromIpcManagedSettings = () => {
  return merge(
    defer(() => ipc.platform.getManagedSettings()),
    fromEventPattern<Record<string, unknown>>((handler) =>
      ipc.platform.onManagedSettingsUpdated((bag) => handler(bag)),
    ),
  );
};
