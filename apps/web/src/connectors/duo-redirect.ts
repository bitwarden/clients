// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { getQsParam } from "./common";
import { TranslationService } from "./translation.service";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./duo-redirect.scss");

const mobileDesktopCallback = "bitwarden://duo-callback";
let localeService: TranslationService = null;

window.addEventListener("load", async () => {
  const redirectUrl = getQsParam("duoFramelessUrl");

  if (redirectUrl) {
    redirectToDuoFrameless(redirectUrl);
    return;
  }

  const client = getQsParam("client");
  const code = getQsParam("code");
  const state = getQsParam("state");

  localeService = new TranslationService(navigator.language, "locales");
  await localeService.init();

  if (client === "web") {
    const channel = new BroadcastChannel("duoResult");

    channel.postMessage({ code: code, state: state });
    channel.close();

    displayHandoffMessage(client);
  } else if (client === "browser") {
    window.postMessage({ command: "duoResult", code: code, state: state }, "*");
    displayHandoffMessage(client);
  } else if (client === "mobile" || client === "desktop") {
    if (client === "desktop") {
      displayHandoffMessage(client);
    }
    document.location.replace(
      mobileDesktopCallback +
        "?code=" +
        encodeURIComponent(code) +
        "&state=" +
        encodeURIComponent(state),
    );
  }
});

/**
 * validate the Duo AuthUrl and redirect to it.
 * @param redirectUrl the duo auth url
 */
function redirectToDuoFrameless(redirectUrl: string) {
  const validateUrl = new URL(redirectUrl);
  const validDuoUrl =
    validateUrl.protocol === "https:" &&
    (validateUrl.hostname.endsWith(".duosecurity.com") ||
      validateUrl.hostname.endsWith(".duofederal.com"));

  if (!validDuoUrl) {
    throw new Error("Invalid redirect URL");
  }

  window.location.href = decodeURIComponent(redirectUrl);
}

/**
 * Note: browsers won't let javascript close a tab (button or otherwise) that wasn't opened by javascript,
 * so browser, desktop, and mobile are not able to take advantage of the countdown timer or close button.
 */
function displayHandoffMessage(client: string) {
  const content = document.getElementById("content");
  content.className = "text-center";
  content.innerHTML = "";

  const h1 = document.createElement("h1");
  const p = document.createElement("p");

  h1.textContent = localeService.t("youSuccessfullyLoggedIn");
  p.textContent =
    client == "web"
      ? (p.textContent = localeService.t("thisWindowWillCloseIn5Seconds"))
      : localeService.t("youMayCloseThisWindow");

  h1.className = "font-weight-semibold";
  p.className = "mb-4";

  content.appendChild(h1);
  content.appendChild(p);

  // Web client will have a close button as well as an auto close timer
  if (client == "web") {
    const button = document.createElement("button");
    button.textContent = localeService.t("close");
    button.className = "bg-primary text-white border-0 rounded py-2 px-3";

    button.addEventListener("click", () => {
      window.close();
    });
    content.appendChild(button);

    // Countdown timer (closes tab upon completion)
    let num = Number(p.textContent.match(/\d+/)[0]);

    const interval = setInterval(() => {
      if (num > 1) {
        p.textContent = p.textContent.replace(String(num), String(num - 1));
        num--;
      } else {
        clearInterval(interval);
        window.close();
      }
    }, 1000);
  }
}
