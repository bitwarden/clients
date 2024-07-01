import { animate, group, query, style, transition, trigger } from "@angular/animations";

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

const speed = "0.4s";

export function queryTranslate(
  direction: string,
  axis: string,
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
      animate(speed + " ease-in-out", style({ transform: "translate" + axis + "(" + to + "%)" })),
    ],
    { optional: true },
  );
}

export function queryTranslateX(direction: string, from: number, to: number, zIndex = 1000) {
  return queryTranslate(direction, "X", from, to, zIndex);
}

export function queryTranslateY(direction: string, from: number, to: number, zIndex = 1000) {
  return queryTranslate(direction, "Y", from, to, zIndex);
}

const inSlideLeft = [
  queryShown,
  group([queryTranslateX("enter", 100, 0), queryTranslateX("leave", 0, -100), queryChildRoute]),
];

const outSlideRight = [
  queryShown,
  group([queryTranslateX("enter", -100, 0), queryTranslateX("leave", 0, 100)]),
];

const inSlideUp = [
  queryShown,
  group([queryTranslateY("enter", 100, 0, 1010), queryTranslateY("leave", 0, 0), queryChildRoute]),
];

const outSlideDown = [
  queryShown,
  group([queryTranslateY("enter", 0, 0), queryTranslateY("leave", 0, 100, 1010)]),
];

const inSlideDown = [
  queryShown,
  group([queryTranslateY("enter", -100, 0, 1010), queryTranslateY("leave", 0, 0), queryChildRoute]),
];

// eslint-disable-next-line
const outSlideUp = [
  queryShown,
  group([queryTranslateY("enter", 0, 0), queryTranslateY("leave", 0, -100, 1010)]),
];

export function tabsToCiphers(fromState: string, toState: string) {
  if (fromState == null || toState === null || toState.indexOf("ciphers_") === -1) {
    return false;
  }
  return (
    (fromState.indexOf("ciphers_") === 0 && fromState.indexOf("ciphers_direction=b") === -1) ||
    fromState === "tabs"
  );
}

export function ciphersToTabs(fromState: string, toState: string) {
  if (fromState == null || toState === null || fromState.indexOf("ciphers_") === -1) {
    return false;
  }
  return toState.indexOf("ciphers_direction=b") === 0 || toState === "tabs";
}

export function ciphersToView(fromState: string, toState: string) {
  if (fromState == null || toState === null) {
    return false;
  }
  return (
    fromState.indexOf("ciphers_") === 0 &&
    (toState === "view-cipher" || toState === "add-cipher" || toState === "clone-cipher")
  );
}

export function viewToCiphers(fromState: string, toState: string) {
  if (fromState == null || toState === null) {
    return false;
  }
  return (
    (fromState === "view-cipher" || fromState === "add-cipher" || fromState === "clone-cipher") &&
    toState.indexOf("ciphers_") === 0
  );
}

export const routerTransition = trigger("routerTransition", [
  transition("void => home", inSlideLeft),
  transition("void => tabs", inSlideLeft),

  transition("home => environment, home => login, home => register", inSlideUp),

  transition("login => home", outSlideDown),
  transition("login => hint", inSlideUp),
  transition("login => tabs, login => 2fa, login => login-with-device", inSlideLeft),

  transition("hint => login, register => home, environment => home", outSlideDown),

  transition("2fa => login", outSlideRight),
  transition("2fa => 2fa-options", inSlideUp),
  transition("2fa-options => 2fa", outSlideDown),
  transition("2fa => tabs", inSlideLeft),

  transition("login-with-device => tabs, login-with-device => 2fa", inSlideLeft),
  transition("login-with-device => login", outSlideRight),

  transition(tabsToCiphers, inSlideLeft),
  transition(ciphersToTabs, outSlideRight),

  transition(ciphersToView, inSlideUp),
  transition(viewToCiphers, outSlideDown),

  transition("tabs => view-cipher", inSlideUp),
  transition("view-cipher => tabs", outSlideDown),

  transition("view-cipher => edit-cipher, view-cipher => cipher-password-history", inSlideUp),
  transition(
    "edit-cipher => view-cipher, cipher-password-history => view-cipher, edit-cipher => tabs",
    outSlideDown,
  ),

  transition("view-cipher => clone-cipher", inSlideUp),
  transition("clone-cipher => view-cipher, clone-cipher => tabs", outSlideDown),

  transition("view-cipher => share-cipher", inSlideUp),
  transition("share-cipher => view-cipher", outSlideDown),

  transition("tabs => add-cipher", inSlideUp),
  transition("add-cipher => tabs", outSlideDown),

  transition("generator => generator-history, tabs => generator-history", inSlideLeft),
  transition("generator-history => generator, generator-history => tabs", outSlideRight),

  transition(
    "add-cipher => generator, edit-cipher => generator, clone-cipher => generator",
    inSlideUp,
  ),
  transition(
    "generator => add-cipher, generator => edit-cipher, generator => clone-cipher",
    outSlideDown,
  ),

  transition("edit-cipher => attachments, edit-cipher => collections", inSlideLeft),
  transition("attachments => edit-cipher, collections => edit-cipher", outSlideRight),

  transition("clone-cipher => attachments, clone-cipher => collections", inSlideLeft),
  transition("attachments => clone-cipher, collections => clone-cipher", outSlideRight),

  transition("tabs => account-security", inSlideLeft),
  transition("account-security => tabs", outSlideRight),

  transition("tabs => assign-collections", inSlideLeft),
  transition("assign-collections => tabs", outSlideRight),

  // Vault settings
  transition("tabs => vault-settings", inSlideLeft),
  transition("vault-settings => tabs", outSlideRight),

  transition("vault-settings => import", inSlideLeft),
  transition("import => vault-settings", outSlideRight),

  transition("vault-settings => export", inSlideLeft),
  transition("export => vault-settings", outSlideRight),

  transition("vault-settings => folders", inSlideLeft),
  transition("folders => vault-settings", outSlideRight),

  transition("folders => edit-folder, folders => add-folder", inSlideUp),
  transition("edit-folder => folders, add-folder => folders", outSlideDown),

  transition("vault-settings => sync", inSlideLeft),
  transition("sync => vault-settings", outSlideRight),

  // Appearance settings
  transition("tabs => appearance", inSlideLeft),
  transition("appearance => tabs", outSlideRight),

  transition("tabs => premium", inSlideLeft),
  transition("premium => tabs", outSlideRight),

  transition("tabs => lock", inSlideDown),

  transition("tabs => about", inSlideLeft),
  transition("about => tabs", outSlideRight),

  transition("tabs => send-type", inSlideLeft),
  transition("send-type => tabs", outSlideRight),

  transition("tabs => add-send, send-type => add-send", inSlideUp),
  transition("add-send => tabs, add-send => send-type", outSlideDown),

  transition("tabs => edit-send, send-type => edit-send", inSlideUp),
  transition("edit-send => tabs, edit-send => send-type", outSlideDown),

  // Notification settings
  transition("tabs => notifications", inSlideLeft),
  transition("notifications => tabs", outSlideRight),

  transition("notifications => excluded-domains", inSlideLeft),
  transition("excluded-domains => notifications", outSlideRight),

  transition("tabs => autofill", inSlideLeft),
  transition("autofill => tabs", outSlideRight),

  transition("* => account-switcher", inSlideUp),
  transition("account-switcher => *", outSlideDown),

  transition("lock => *", outSlideDown),
]);
