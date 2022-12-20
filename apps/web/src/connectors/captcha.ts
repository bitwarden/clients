import { b64Decode, getQsParam } from "./common";

declare let hcaptcha: any;

if (window.location.pathname.includes("mobile")) {
  require("./captcha-mobile.scss");
} else {
  require("./captcha.scss");
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});

(window as any).captchaSuccess = captchaSuccess;
(window as any).captchaError = captchaError;

let parentUrl: string = null;
let parentOrigin: string = null;
let mobileResponse: boolean = null;

async function init() {
  await start();
  onMessage();
}

async function start() {
  const data = getQsParam("data");
  if (!data) {
    error("No data.");
    return;
  }

  parentUrl = getQsParam("parent");
  if (!parentUrl) {
    error("No parent.");
    return;
  } else {
    parentUrl = decodeURIComponent(parentUrl);
    parentOrigin = new URL(parentUrl).origin;
  }

  let decodedData: any;
  try {
    decodedData = JSON.parse(b64Decode(data, true));
  } catch (e) {
    error("Cannot parse data.");
    return;
  }
  mobileResponse = decodedData.callbackUri != null || decodedData.mobile === true;

  let src = "https://hcaptcha.com/1/api.js?render=explicit";

  // Set language code
  if (decodedData.locale) {
    src += `&hl=${encodeURIComponent(decodedData.locale) ?? "en"}`;
  }

  // Set captchaRequired subtitle for mobile
  const subtitleEl = document.getElementById("captchaRequired");
  if (decodedData.captchaRequiredText && subtitleEl) {
    subtitleEl.textContent = decodedData.captchaRequiredText;
  }

  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  script.addEventListener("load", () => {
    hcaptcha.render("captcha", {
      sitekey: encodeURIComponent(decodedData.siteKey),
      callback: "captchaSuccess",
      "error-callback": "captchaError",
    });
    watchHeight();
  });
  document.head.appendChild(script);
}

function captchaSuccess(response: string) {
  if (mobileResponse) {
    document.location.replace("bitwarden://captcha-callback?token=" + encodeURIComponent(response));
  } else {
    success(response);
  }
}

function captchaError() {
  error("An error occurred with the captcha. Try again.");
}

function onMessage() {
  window.addEventListener(
    "message",
    (event) => {
      if (!event.origin || event.origin === "" || event.origin !== parentOrigin) {
        return;
      }

      if (event.data === "start") {
        start();
      }

      if (event.data === "reload") {
        hcaptcha.reset();
      }
    },
    false
  );
}

function error(message: string) {
  parent.postMessage("error|" + message, parentUrl);
}

function success(data: string) {
  parent.postMessage("success|" + data, parentUrl);
}

function info(message: string | object) {
  parent.postMessage("info|" + JSON.stringify(message), parentUrl);
}

async function watchHeight() {
  const imagesDiv = document.body.lastChild as HTMLElement;
  // eslint-disable-next-line
  while (true) {
    info({
      height:
        imagesDiv.style.visibility === "hidden"
          ? document.documentElement.offsetHeight
          : document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
    });
    await sleep(100);
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}
