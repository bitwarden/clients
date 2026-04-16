import { Observable, distinctUntilChanged, map } from "rxjs";

import { GlobalStateProvider, KeyDefinition, ANIMATION_DISK } from "../state";

export abstract class AnimationControlService {
  /**
   * The routing animation toggle.
   */
  abstract enableRoutingAnimation$: Observable<boolean>;

  /**
   * Whether autofill input scaling animations are enabled.
   * Currently backed by the routing animation state; will be decoupled in the future.
   * Emits when the animation state changes and completes when the underlying state is torn down.
   */
  abstract enableAutofillAnimation$: Observable<boolean>;

  /**
   * Whether notification bar animations are enabled.
   * Currently backed by the routing animation state; will be decoupled in the future.
   * Emits when the animation state changes and completes when the underlying state is torn down.
   */
  abstract enableNotificationAnimation$: Observable<boolean>;

  /**
   * Whether inline menu animations are enabled.
   * Currently backed by the routing animation state; will be decoupled in the future.
   * Emits when the animation state changes and completes when the underlying state is torn down.
   */
  abstract enableInlineMenuAnimation$: Observable<boolean>;

  /**
   * A method for updating the state of the animation toggle.
   * @param theme The new state.
   */
  abstract setEnableRoutingAnimation(state: boolean): Promise<void>;
}

const ROUTING_ANIMATION = new KeyDefinition<boolean>(ANIMATION_DISK, "routing", {
  deserializer: (s) => s,
});

export class DefaultAnimationControlService implements AnimationControlService {
  private readonly enableRoutingAnimationState = this.globalStateProvider.get(ROUTING_ANIMATION);

  enableRoutingAnimation$ = this.enableRoutingAnimationState.state$.pipe(
    map((state) => state ?? this.defaultEnableRoutingAnimation),
  );

  // Proxying `enableRoutingAnimation` for now to enable future decoupling
  enableAutofillAnimation$ = this.enableRoutingAnimation$.pipe(distinctUntilChanged());
  enableNotificationAnimation$ = this.enableRoutingAnimation$.pipe(distinctUntilChanged());
  enableInlineMenuAnimation$ = this.enableRoutingAnimation$.pipe(distinctUntilChanged());

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private defaultEnableRoutingAnimation: boolean = true,
  ) {}

  async setEnableRoutingAnimation(state: boolean): Promise<void> {
    await this.enableRoutingAnimationState.update(() => state, {
      shouldUpdate: (currentState) => currentState !== state,
    });
  }
}
