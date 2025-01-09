import { Observable, map } from "rxjs";

import { GlobalStateProvider, KeyDefinition, ANIMATION_DISK } from "../state";

export abstract class AnimationControlService {
  /**
   * The routing animation toggle.
   */
  abstract enableRoutingAnimation$: Observable<boolean>;

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
