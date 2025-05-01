import {
  animate,
  AnimationMetadata,
  group,
  query,
  style,
  transition,
  trigger,
} from "@angular/animations";

/**
 * Determines the router transition behavior.
 * Changing between elevations will animate from the right.
 * Navigating between two pages of the same elevation will not animate.
 */
export type RouteElevation = 0 | 1 | 2 | 3 | 4;

const queryShown = query(
  ":enter, :leave",
  [style({ position: "fixed", width: "100%", height: "100%" })],
  {
    optional: true,
  },
);

// ref: https://github.com/angular/angular/issues/15477
const queryChildRoute = query("router-outlet ~ *", [style({}), animate(1, style({}))], {
  optional: true,
});

const speedX = "0.225s";
const speedY = "0.3s";

type TranslateDirection = "enter" | "leave";
type TranslationAxis = "X" | "Y";

function queryTranslate(
  direction: TranslateDirection,
  axis: TranslationAxis,
  from: number,
  to: number,
  zIndex = 1000,
) {
  return query(
    ":" + direction,
    [
      style({
        transform: "translate" + axis + "(" + from + "%)",
        zIndex: zIndex,
        boxShadow: "0 3px 2px -2px gray",
      }),
      animate(
        (axis === "X" ? speedX : speedY) + " ease-in-out",
        style({
          transform: "translate" + axis + "(" + to + "%)",
        }),
      ),
    ],
    {
      optional: true,
    },
  );
}

const animations = {
  slideInFromRight: [
    queryShown,
    group([
      queryTranslate("enter", "X", 100, 0, 1010),
      queryTranslate("leave", "X", 0, 0),
      queryChildRoute,
    ]),
  ],
  slideOutToRight: [
    queryShown,
    group([queryTranslate("enter", "X", 0, 0), queryTranslate("leave", "X", 0, 100, 1010)]),
  ],
  /** --- Not used --- */
  // slideInFromTop: [
  //   queryShown,
  //   group([
  //     queryTranslate("enter", "Y", -100, 0, 1010),
  //     queryTranslate("leave", "Y", 0, 0),
  //     queryChildRoute,
  //   ]),
  // ],
  // slideOutToTop: [
  //   queryShown,
  //   group([queryTranslate("enter", "Y", 0, 0), queryTranslate("leave", "Y", 0, -100, 1010)]),
  // ],
} satisfies Record<string, AnimationMetadata[]>;

export const routerTransition = trigger("routerTransition", [
  transition("0 => 1", animations.slideInFromRight),
  transition("0 => 2", animations.slideInFromRight),
  transition("0 => 3", animations.slideInFromRight),
  transition("0 => 4", animations.slideInFromRight),
  transition("1 => 2", animations.slideInFromRight),
  transition("1 => 3", animations.slideInFromRight),
  transition("1 => 4", animations.slideInFromRight),
  transition("2 => 3", animations.slideInFromRight),
  transition("2 => 4", animations.slideInFromRight),
  transition("3 => 4", animations.slideInFromRight),

  transition("1 => 0", animations.slideOutToRight),
  transition("2 => 0", animations.slideOutToRight),
  transition("2 => 1", animations.slideOutToRight),
  transition("3 => 0", animations.slideOutToRight),
  transition("3 => 1", animations.slideOutToRight),
  transition("3 => 2", animations.slideOutToRight),
  transition("4 => 0", animations.slideOutToRight),
  transition("4 => 1", animations.slideOutToRight),
  transition("4 => 2", animations.slideOutToRight),
  transition("4 => 3", animations.slideOutToRight),
]);
