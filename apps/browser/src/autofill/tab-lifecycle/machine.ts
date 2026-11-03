import { TabEdgeCause, TabState } from "./enums";
import type { MachineContext, TabLifecycleEvent } from "./types";

/**
 * The context a tab occupies once `event` is applied.
 *
 * This function is a deterministic finite automata; `tabLifecycle` (`./rx.ts`) adds
 * nondeterministic timed exits.
 *
 * Returns the **same reference** it was handed when the event changes nothing, so a no-op
 * is detectable by identity.
 */
export function transition(ctx: MachineContext, event: TabLifecycleEvent): MachineContext {
  const { state, focused } = ctx;
  switch (event.kind) {
    case "logout":
      // The user signs out, or the account is removed. Every tab is affected at once, whatever
      // each was doing, and no amount of browser activity brings one back.
      return state === TabState.Frozen
        ? ctx
        : { state: TabState.Frozen, focused, cause: TabEdgeCause.Logout };

    case "login":
      // The user signs in. Signing in says nothing about which tab the user is looking at, so
      // every tab starts from the resting position and the activation signals that follow
      // promote whichever one the browser reports as active.
      return state === TabState.Frozen
        ? { state: TabState.Cold, focused, cause: TabEdgeCause.Login }
        : ctx;

    case "activate":
      if (state === TabState.Frozen) {
        return ctx;
      }
      // The user switches to a tab they were not viewing.
      if (state === TabState.Cold) {
        return { state: TabState.WarmUp, focused: event.focused, cause: TabEdgeCause.Activate };
      }
      if (state === TabState.CoolDown) {
        // The user glances at another tab and comes straight back, inside the grace period.
        return event.focused
          ? { state: TabState.Hot, focused: true, cause: TabEdgeCause.Activate }
          : { state: TabState.Warm, focused: false, cause: TabEdgeCause.Activate };
      }
      // The browser re-reports activation for the tab that is already active — its window
      // gained or lost focus alongside the activation. Only the focus axis has moved.
      return event.focused === focused ? ctx : { ...ctx, focused: event.focused };

    case "deactivate":
      if (state === TabState.WarmUp || state === TabState.Warm) {
        // A tab cycled past with ctrl+tab, or a background window's active tab being replaced.
        return { state: TabState.Cold, focused, cause: TabEdgeCause.Deactivate };
      }
      // The user leaves the tab they were working in.
      if (state === TabState.Hot) {
        return { state: TabState.CoolDown, focused, cause: TabEdgeCause.Deactivate };
      }
      return ctx;

    case "focus":
      // The user returns to the window this tab is active in.
      if (state === TabState.Warm) {
        return { state: TabState.Hot, focused: true, cause: TabEdgeCause.Focus };
      }
      // Focus arriving mid-settle redirects where the tab is headed; on a tab already being looked
      // at it tells us nothing new. A tab that is not its window's active tab gains nothing from
      // that window being focused, so everywhere else the signal is inert.
      if (state === TabState.WarmUp || state === TabState.Hot) {
        return focused ? ctx : { ...ctx, focused: true };
      }
      return ctx;

    case "blur":
      // The user switches to another window, or away from the browser entirely.
      if (state === TabState.Hot) {
        return { state: TabState.Warm, focused: false, cause: TabEdgeCause.Blur };
      }
      // Blur arriving mid-settle redirects where the tab is headed; on a tab already unfocused it
      // tells us nothing new. Elsewhere the signal is inert, as with focus.
      if (state === TabState.WarmUp || state === TabState.Warm) {
        return focused ? { ...ctx, focused: false } : ctx;
      }
      return ctx;

    case "command":
      // The user asks for a fill directly — a keyboard shortcut, or a context-menu choice. The
      // request is its own evidence that the user is looking at the tab, so it is trusted ahead of
      // the settle it would otherwise have waited out, and the window is taken to be focused even
      // if the machine has not been told so yet.
      return state === TabState.WarmUp
        ? { state: TabState.Hot, focused: true, cause: TabEdgeCause.Command }
        : ctx;
  }
}
