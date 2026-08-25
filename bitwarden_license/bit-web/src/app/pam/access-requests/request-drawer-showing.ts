import { Signal, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

/**
 * Whether a request drawer is showing right now, read from the `requestId` query param that names
 * it (the shell, `AccessRequestsComponent`, owns the drawer itself).
 *
 * A tab's row links bind this to `replaceUrl`, which is what keeps browser Back useful: opening a
 * request from the bare list pushes, so Back has the list to return to, while swapping straight
 * from one open request to another replaces, so at most one drawer entry ever sits above the list
 * and Back never walks through every request the reader opened.
 */
export function requestDrawerShowing(): Signal<boolean> {
  const route = inject(ActivatedRoute);

  return toSignal(route.queryParams.pipe(map((params) => typeof params.requestId === "string")), {
    initialValue: false,
  });
}
