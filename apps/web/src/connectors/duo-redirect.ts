import { getQsParam } from "./common";
import { TranslationService } from "./translation.service";

const mobileDesktopCallback = "bitwarden://duo-callback";
let localeService: TranslationService | null = null;

window.addEventListener("load", async () => {
  const redirectUrl = getQsParam("duoFramelessUrl");

  if (redirectUrl) {
    redirectToDuoFrameless(redirectUrl);
    return;
  }

  const client: string | null = getQsParam("client");
  const code: string | null = getQsParam("code");
  const state: string | null = getQsParam("state");
  if (!client) {
    throw new Error("client is null");
  }
  if (!code) {
    throw new Error("code is null");
  }
  if (!state) {
    throw new Error("state is null");
  }

  localeService = new TranslationService(navigator.language, "locales");
  await localeService.init();

  if (client === "web") {
    const channel = new BroadcastChannel("duoResult");

    channel.postMessage({ code: code, state: state });
    channel.close();

    displayHandoffMessage(client);
  } else if (client === "browser") {
    window.postMessage({ command: "duoResult", code, state }, window.location.origin);
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
export function redirectToDuoFrameless(redirectUrl: string) {
  // Regex to match a valid duo redirect URL
  /**
   * This regex checks for the following:
   * The string must start with "https://api-"
   * Followed by a subdomain that can contain letters, numbers
   * Followed by either "duosecurity.com" or "duofederal.com"
   * This ensures that the redirect does not contain any malicious content
   * and is a valid Duo URL.
   * */
  const duoRedirectUrlRegex = /^https:\/\/api-[a-zA-Z0-9]+\.(duosecurity|duofederal)\.com/;
  // Check if the redirect URL matches the regex
  if (!duoRedirectUrlRegex.test(redirectUrl)) {
    throw new Error("Invalid redirect URL");
  }
  // At this point we know the URL to be valid, but we need to check for embedded credentials
  const validateUrl = new URL(redirectUrl);
  // URLs should not contain
  // Check that no embedded credentials are present
  if (validateUrl.username || validateUrl.password) {
    throw new Error("Invalid redirect URL: embedded credentials not allowed");
  }

  window.location.href = decodeURIComponent(redirectUrl);
}

/**
 * Note: browsers won't let javascript close a tab (button or otherwise) that wasn't opened by javascript,
 * so browser, desktop, and mobile are not able to take advantage of the countdown timer or close button.
 */
function displayHandoffMessage(client: string) {
  const content: HTMLElement | null = document.getElementById("content");
  if (!content) {
    throw new Error("content element not found");
  }
  content.className = "text-center";
  content.innerHTML = "";

  const h1 = document.createElement("h1");
  const p: HTMLElement = document.createElement("p");

  if (!localeService) {
    throw new Error("localeService is not initialized");
  }
  h1.textContent = localeService.t("youSuccessfullyLoggedIn");
  p.textContent =
    client == "web"
      ? localeService.t("thisWindowWillCloseIn5Seconds")
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

    if (p.textContent === null) {
      throw new Error("count down container is null");
    }
    const counterString: string | null = p.textContent.match(/\d+/)?.[0] || null;
    if (!counterString) {
      throw new Error("count down time cannot be null");
    }

    let num: number = Number(counterString);
    const interval = setInterval(() => {
      if (num > 1) {
        if (p.textContent === null) {
          throw new Error("count down container is null");
        }
        p.textContent = p.textContent.replace(String(num), String(num - 1));
        num--;
      } else {
        clearInterval(interval);
        window.close();
      }
    }, 1000);
  }
}
