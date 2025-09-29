// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
/**
 * MIT License
 *
 * Copyright (c) Federico Brigante <me@fregante.com> (https://fregante.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * @see https://github.com/fregante/content-scripts-register-polyfill
 * @version 4.0.2
 */
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import { BrowserApi } from "./browser-api";

let registerContentScripts: (
  contentScriptOptions: browser.contentScripts.RegisteredContentScriptOptions,
  callback?: (registeredContentScript: browser.contentScripts.RegisteredContentScript) => void,
) => Promise<browser.contentScripts.RegisteredContentScript>;
export async function registerContentScriptsPolyfill(
  contentScriptOptions: browser.contentScripts.RegisteredContentScriptOptions,
  callback?: (registeredContentScript: browser.contentScripts.RegisteredContentScript) => void,
) {
  if (!registerContentScripts) {
    registerContentScripts = buildRegisterContentScriptsPolyfill();
  }

  return registerContentScripts(contentScriptOptions, callback);
}

function buildRegisterContentScriptsPolyfill() {
  const logService = new ConsoleLogService(false);
  const chromeProxy = globalThis.chrome && NestedProxy<typeof globalThis.chrome>(globalThis.chrome);
  const patternValidationRegex =
    /^(https?|wss?|file|ftp|\*):\/\/(\*|\*\.[^*/]+|[^*/]+)\/.*$|^file:\/\/\/.*$|^resource:\/\/(\*|\*\.[^*/]+|[^*/]+)\/.*$|^about:/;
  const isFirefox = globalThis.navigator?.userAgent.includes("Firefox/");
  const gotScripting = Boolean(globalThis.chrome?.scripting);
  const gotNavigation = typeof chrome === "object" && "webNavigation" in chrome;

  function NestedProxy<T extends object>(target: T): T {
    return new Proxy(target, {
      get(target, prop) {
        if (!target[prop as keyof T]) {
          return;
        }

        if (typeof target[prop as keyof T] !== "function") {
          return NestedProxy(target[prop as keyof T] as object);
        }

        return (...arguments_: any[]) =>
          new Promise((resolve, reject) => {
            (target[prop as keyof T] as CallableFunction)(...arguments_, (result: any) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          });
      },
    });
  }

  function assertValidPattern(matchPattern: string) {
    if (!isValidPattern(matchPattern)) {
      throw new Error(
        `${matchPattern} is an invalid pattern, it must match ${String(patternValidationRegex)}`,
      );
    }
  }

  function isValidPattern(matchPattern: string) {
    return matchPattern === "<all_urls>" || patternValidationRegex.test(matchPattern);
  }

  function getRawPatternRegex(matchPattern: string) {
    assertValidPattern(matchPattern);
    let [, protocol, host = "", pathname] = matchPattern.split(/(^[^:]+:[/][/])([^/]+)?/);
    protocol = protocol
      .replace("*", isFirefox ? "(https?|wss?)" : "https?")
      .replaceAll(/[/]/g, "[/]");

    if (host === "*") {
      host = "[^/]+";
    } else if (host) {
      host = host
        .replace(/^[*][.]/, "([^/]+.)*")
        .replaceAll(/[.]/g, "[.]")
        .replace(/[*]$/, "[^.]+");
    }

    pathname = pathname
      .replaceAll(/[/]/g, "[/]")
      .replaceAll(/[.]/g, "[.]")
      .replaceAll(/[*]/g, ".*");

    return "^" + protocol + host + "(" + pathname + ")?$";
  }

  function patternToRegex(...matchPatterns: string[]) {
    if (matchPatterns.length === 0) {
      return /$./;
    }

    if (matchPatterns.includes("<all_urls>")) {
      // <all_urls> regex
      return /^(https?|file|ftp):[/]+/;
    }

    if (matchPatterns.includes("*://*/*")) {
      // all stars regex
      return isFirefox ? /^(https?|wss?):[/][/][^/]+([/].*)?$/ : /^https?:[/][/][^/]+([/].*)?$/;
    }

    return new RegExp(matchPatterns.map((x) => getRawPatternRegex(x)).join("|"));
  }

  function castAllFramesTarget(target: number | { tabId: number; frameId: number }) {
    if (typeof target === "object") {
      return { ...target, allFrames: false };
    }

    return {
      tabId: target,
      frameId: undefined,
      allFrames: true,
    };
  }

  function castArray(possibleArray: any | any[]) {
    if (Array.isArray(possibleArray)) {
      return possibleArray;
    }

    return [possibleArray];
  }

  function arrayOrUndefined(value?: number) {
    return value === undefined ? undefined : [value];
  }

  async function insertCSS(
    {
      tabId,
      frameId,
      files,
      allFrames,
      matchAboutBlank,
      runAt,
    }: {
      tabId: number;
      frameId?: number;
      files: browser.extensionTypes.ExtensionFileOrCode[];
      allFrames: boolean;
      matchAboutBlank: boolean;
      runAt: browser.extensionTypes.RunAt;
    },
    { ignoreTargetErrors }: { ignoreTargetErrors?: boolean } = {},
  ) {
    const everyInsertion = Promise.all(
      files.map(async (content) => {
        if (typeof content === "string") {
          content = { file: content };
        }

        if (gotScripting) {
          return chrome.scripting.insertCSS({
            target: {
              tabId,
              frameIds: arrayOrUndefined(frameId),
              allFrames: frameId === undefined ? allFrames : undefined,
            },
            files: "file" in content ? [content.file] : undefined,
            css: "code" in content ? content.code : undefined,
          });
        }

        return chromeProxy.tabs.insertCSS(tabId, {
          ...content,
          matchAboutBlank,
          allFrames,
          frameId,
          runAt: runAt ?? "document_start",
        });
      }),
    );

    if (ignoreTargetErrors) {
      await catchTargetInjectionErrors(everyInsertion);
    } else {
      await everyInsertion;
    }
  }
  function assertNoCode(files: browser.extensionTypes.ExtensionFileOrCode[]) {
    if (files.some((content) => "code" in content)) {
      throw new Error("chrome.scripting does not support injecting strings of `code`");
    }
  }

  async function executeScript(
    {
      tabId,
      frameId,
      files,
      allFrames,
      matchAboutBlank,
      runAt,
    }: {
      tabId: number;
      frameId?: number;
      files: browser.extensionTypes.ExtensionFileOrCode[];
      allFrames: boolean;
      matchAboutBlank: boolean;
      runAt: browser.extensionTypes.RunAt;
    },
    { ignoreTargetErrors }: { ignoreTargetErrors?: boolean } = {},
  ) {
    const normalizedFiles = files.map((file) => (typeof file === "string" ? { file } : file));

    if (gotScripting) {
      assertNoCode(normalizedFiles);
      const injection = chrome.scripting.executeScript({
        target: {
          tabId,
          frameIds: arrayOrUndefined(frameId),
          allFrames: frameId === undefined ? allFrames : undefined,
        },
        files: normalizedFiles.map(({ file }: { file: string }) => file),
      });

      if (ignoreTargetErrors) {
        await catchTargetInjectionErrors(injection);
      } else {
        await injection;
      }

      return;
    }

    const executions = [];
    for (const content of normalizedFiles) {
      if ("code" in content) {
        await executions.at(-1);
      }

      executions.push(
        chromeProxy.tabs.executeScript(tabId, {
          ...content,
          matchAboutBlank,
          allFrames,
          frameId,
          runAt,
        }),
      );
    }

    if (ignoreTargetErrors) {
      await catchTargetInjectionErrors(Promise.all(executions));
    } else {
      await Promise.all(executions);
    }
  }

  async function injectContentScript(
    where: { tabId: number; frameId: number },
    scripts: {
      css: browser.extensionTypes.ExtensionFileOrCode[];
      js: browser.extensionTypes.ExtensionFileOrCode[];
      matchAboutBlank: boolean;
      runAt: browser.extensionTypes.RunAt;
    },
    options = {},
  ) {
    const targets = castArray(where);
    await Promise.all(
      targets.map(async (target) =>
        injectContentScriptInSpecificTarget(castAllFramesTarget(target), scripts, options),
      ),
    );
  }

  async function injectContentScriptInSpecificTarget(
    { frameId, tabId, allFrames }: { frameId?: number; tabId: number; allFrames: boolean },
    scripts: {
      css: browser.extensionTypes.ExtensionFileOrCode[];
      js: browser.extensionTypes.ExtensionFileOrCode[];
      matchAboutBlank: boolean;
      runAt: browser.extensionTypes.RunAt;
    },
    options = {},
  ) {
    const injections = castArray(scripts).flatMap((script) => [
      insertCSS(
        {
          tabId,
          frameId,
          allFrames,
          files: script.css ?? [],
          matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
          runAt: script.runAt ?? script.run_at,
        },
        options,
      ),
      executeScript(
        {
          tabId,
          frameId,
          allFrames,
          files: script.js ?? [],
          matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
          runAt: script.runAt ?? script.run_at,
        },
        options,
      ),
    ]);
    await Promise.all(injections);
  }

  async function catchTargetInjectionErrors(promise: Promise<any>) {
    try {
      await promise;
    } catch (error) {
      const targetErrors =
        /^No frame with id \d+ in tab \d+.$|^No tab with id: \d+.$|^The tab was closed.$|^The frame was removed.$/;
      if (!targetErrors.test(error?.message)) {
        throw error;
      }
    }
  }

  async function isOriginPermitted(url: string) {
    return chromeProxy.permissions.contains({
      origins: [new URL(url).origin + "/*"],
    });
  }

  return async (
    contentScriptOptions: browser.contentScripts.RegisteredContentScriptOptions,
    callback: CallableFunction,
  ) => {
    const {
      js = [],
      css = [],
      matchAboutBlank,
      matches = [],
      excludeMatches,
      runAt,
    } = contentScriptOptions;
    let { allFrames } = contentScriptOptions;

    if (gotNavigation) {
      allFrames = false;
    } else if (allFrames) {
      logService.warning(
        "`allFrames: true` requires the `webNavigation` permission to work correctly: https://github.com/fregante/content-scripts-register-polyfill#permissions",
      );
    }

    if (matches.length === 0) {
      throw new Error(
        "Type error for parameter contentScriptOptions (Error processing matches: Array requires at least 1 items; you have 0) for contentScripts.register.",
      );
    }

    await Promise.all(
      matches.map(async (pattern: string) => {
        if (!(await chromeProxy.permissions.contains({ origins: [pattern] }))) {
          throw new Error(`Permission denied to register a content script for ${pattern}`);
        }
      }),
    );

    const matchesRegex = patternToRegex(...matches);
    const excludeMatchesRegex = patternToRegex(
      ...(excludeMatches !== null && excludeMatches !== void 0 ? excludeMatches : []),
    );
    const inject = async (url: string, tabId: number, frameId = 0) => {
      if (
        !matchesRegex.test(url) ||
        excludeMatchesRegex.test(url) ||
        !(await isOriginPermitted(url))
      ) {
        return;
      }

      await injectContentScript(
        { tabId, frameId },
        { css, js, matchAboutBlank, runAt },
        { ignoreTargetErrors: true },
      );
    };
    const tabListener = async (
      tabId: number,
      { status }: chrome.tabs.TabChangeInfo,
      { url }: chrome.tabs.Tab,
    ) => {
      if (status === "loading" && url) {
        void inject(url, tabId);
      }
    };
    const navListener = async ({
      tabId,
      frameId,
      url,
    }: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      void inject(url, tabId, frameId);
    };

    if (gotNavigation) {
      BrowserApi.addListener(chrome.webNavigation.onCommitted, navListener);
    } else {
      BrowserApi.addListener(chrome.tabs.onUpdated, tabListener);
    }

    const registeredContentScript = {
      async unregister() {
        if (gotNavigation) {
          chrome.webNavigation.onCommitted.removeListener(navListener);
        } else {
          chrome.tabs.onUpdated.removeListener(tabListener);
        }
      },
    };

    if (typeof callback === "function") {
      callback(registeredContentScript);
    }

    return registeredContentScript;
  };
}
