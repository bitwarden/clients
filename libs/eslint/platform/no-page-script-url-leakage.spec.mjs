import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { errorMessage } from "./no-page-script-url-leakage.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      project: [__dirname + "/../tsconfig.spec.json"],
      projectService: {
        allowDefaultProject: ["*.ts*"],
      },
      tsconfigRootDir: __dirname + "/..",
    },
  },
});

ruleTester.run("no-page-script-url-leakage", rule.default, {
  valid: [
    {
      name: "Non-script element with extension URL (iframe)",
      code: `
        const iframe = document.createElement("iframe");
        iframe.src = chrome.runtime.getURL("popup.html");
      `,
    },
    {
      name: "Non-script element with extension URL (img)",
      code: `
        const img = document.createElement("img");
        img.src = chrome.runtime.getURL("icon.png");
      `,
    },
    {
      name: "Script element with non-extension URL",
      code: `
        const script = document.createElement("script");
        script.src = "https://example.com/script.js";
      `,
    },
    {
      name: "Extension URL call without DOM assignment",
      code: `
        const url = chrome.runtime.getURL("assets/icon.png");
        console.log(url);
      `,
    },
    {
      name: "Browser runtime call without DOM assignment",
      code: `
        const url = browser.runtime.getURL("content/style.css");
        fetch(url);
      `,
    },
    {
      name: "Script assignment with variable not from createElement",
      code: `
        const script = getSomeScriptElement();
        script.src = chrome.runtime.getURL("script.js");
      `,
    },
    {
      name: "Assignment to different property",
      code: `
        const script = document.createElement("script");
        script.type = "text/javascript";
      `,
    },
  ],
  invalid: [
    {
      name: "Script element with chrome.runtime.getURL - variable declaration",
      code: `
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("content/script.js");
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Script element with browser.runtime.getURL - variable declaration",
      code: `
        const script = document.createElement("script");
        script.src = browser.runtime.getURL("content/script.js");
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Script element with chrome.runtime.getURL - assignment expression",
      code: `
        let script;
        script = document.createElement("script");
        script.src = chrome.runtime.getURL("page-script.js");
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Script element with browser.runtime.getURL - assignment expression",
      code: `
        let element;
        element = document.createElement("script");
        element.src = browser.runtime.getURL("fido2-page-script.js");
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Multiple script elements with different variable names",
      code: `
        const scriptA = document.createElement("script");
        const scriptB = document.createElement("script");
        scriptA.src = chrome.runtime.getURL("script-a.js");
        scriptB.src = browser.runtime.getURL("script-b.js");
      `,
      errors: [
        {
          message: errorMessage,
        },
        {
          message: errorMessage,
        },
      ],
    },
    {
      name: "Real-world pattern that prompted creation of this lint rule",
      code: `
        const script = globalThis.document.createElement("script");
        script.src = chrome.runtime.getURL("content/fido2-page-script.js");
        script.async = false;
      `,
      errors: [
        {
          message: errorMessage,
        },
      ],
    },
  ],
});
