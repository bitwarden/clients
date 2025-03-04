// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";

import {
  AddLoginMessageData,
  ChangePasswordMessageData,
} from "../background/abstractions/notification.background";
import AutofillField from "../models/autofill-field";
import { WatchedForm } from "../models/watched-form";
import { NotificationBarIframeInitData } from "../notification/abstractions/notification-bar";
import { NotificationTypeData } from "../overlay/notifications/abstractions/overlay-notifications-content.service";
import { FormData } from "../services/abstractions/autofill.service";
import { sendExtensionMessage, setupExtensionDisconnectAction } from "../utils";

interface HTMLElementWithFormOpId extends HTMLElement {
  formOpId: string;
}

/**
 * @fileoverview This file contains the code for the Bitwarden Notification Bar content script.
 * The notification bar is used to notify logged in users that they can
 * save a new login, change a existing password on a password change screen,
 * or update an existing login after detecting a different password on login.
 *
 * Note: content scripts are reloaded on non-SPA page change.
 */

/*
 * Run content script when the DOM is fully loaded
 *
 * The DOMContentLoaded event fires when the HTML document has been completely parsed,
 * and all deferred scripts (<script defer src="…"> and <script type="module">) have
 * downloaded and executed. It doesn't wait for other things like images, subframes,
 * and async scripts to finish loading.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/DOMContentLoaded_event
 */
let notificationBarIframe: HTMLIFrameElement = null;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadNotificationBar);
} else {
  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  loadNotificationBar();
}

async function loadNotificationBar() {
  // Initialize required variables and set default values
  const watchedForms: WatchedForm[] = [];
  let barType: string = null;
  let pageHref: string = null;

  // Provides the ability to watch for changes being made to the DOM tree.
  let observer: MutationObserver = null;
  const observeIgnoredElements = new Set([
    "a",
    "i",
    "b",
    "strong",
    "span",
    "code",
    "br",
    "img",
    "small",
    "em",
    "hr",
  ]);
  let domObservationCollectTimeoutId: number = null;
  let collectPageDetailsTimeoutId: number = null;
  let handlePageChangeTimeoutId: number = null;

  const inIframe = isInIframe();
  const cancelButtonNames = new Set(["cancel", "close", "back"]);
  const logInButtonNames = new Set([
    "log in",
    "sign in",
    "login",
    "go",
    "submit",
    "continue",
    "next",
  ]);
  const changePasswordButtonNames = new Set([
    "save password",
    "update password",
    "change password",
    "change",
    "save",
  ]);
  const changePasswordButtonContainsNames = new Set(["pass", "change", "contras", "senha"]);

  const enableChangedPasswordPrompt = await sendExtensionMessage(
    "bgGetEnableChangedPasswordPrompt",
  );
  const enableAddedLoginPrompt = await sendExtensionMessage("bgGetEnableAddedLoginPrompt");
  const excludedDomains = await sendExtensionMessage("bgGetExcludedDomains");
  const activeUserServerConfig: ServerConfig = await sendExtensionMessage(
    "bgGetActiveUserServerConfig",
  );
  const activeUserVault = activeUserServerConfig?.environment?.vault;

  let showNotificationBar = true;

  if (activeUserVault) {
    // Do not show the notification bar on the Bitwarden vault
    // because they can add logins and change passwords there
    if (window.location.origin === activeUserVault) {
      showNotificationBar = false;
    } else {
      // NeverDomains is a dictionary of domains that the user has chosen to never
      // show the notification bar on (for login detail collection or password change).
      // It is managed in the Settings > Excluded Domains page in the browser extension.
      // Example: '{"bitwarden.com":null}'

      if (!excludedDomains || !(window.location.hostname in excludedDomains)) {
        if (enableAddedLoginPrompt || enableChangedPasswordPrompt) {
          // If the user has not disabled both notifications, then handle the initial page change (null -> actual page)
          handlePageChange();
        }
      }
    }
  }

  setupExtensionDisconnectAction(handleExtensionDisconnection);

  if (!showNotificationBar) {
    return;
  }

  // Message Processing

  // Listen for messages from the background script
  // Note: onMessage events are fired when a message is sent from either an extension process
  // (by runtime.sendMessage) or a content script (by tabs.sendMessage).
  // https://developer.chrome.com/docs/extensions/reference/runtime/#event-onMessage
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    processMessages(msg, sendResponse);
  });

  /**
   * Processes messages received from the background script via the `chrome.runtime.onMessage` event.
   * @param {Object} msg - The received message.
   * @param {Function} sendResponse - The function used to send a response back to the background script.
   * @returns {boolean} - Returns `true` if a response was sent, `false` otherwise.
   */
  function processMessages(msg: any, sendResponse: (response?: any) => void) {
    if (msg.command === "openNotificationBar") {
      // `notification.background.ts : doNotificationQueueCheck(...)` sends
      // a message to the content script to open the notification bar
      // on Login Add or Password Change
      if (inIframe) {
        return;
      }
      closeExistingAndOpenBar(msg.data.type, msg.data.typeData);
      sendResponse();
      return true;
    } else if (msg.command === "closeNotificationBar") {
      // The following methods send a message to the content script to close the notification bar:
      // `bar.js : closeButton click` > `notification.background.ts : processMessage(...)`
      // `notification.background.ts : saveNever(...)`
      // `notification.background.ts : saveOrUpdateCredentials(...)`
      if (inIframe) {
        return;
      }
      closeBar(true);
      sendResponse();
      return true;
    } else if (msg.command === "adjustNotificationBar") {
      // `bar.js : window resize` > `notification.background.ts : processMessage(...)`
      // sends a message to the content script to adjust the notification bar
      if (inIframe) {
        return;
      }
      adjustBar(msg.data);
      sendResponse();
      return true;
    } else if (msg.command === "notificationBarPageDetails") {
      // Note: we deliberately do not check for inIframe here because a lot of websites
      // embed their login forms into iframes
      // Ex: icloud.com uses a login form in an iframe from apple.com

      // See method collectPageDetails() for full call itinerary that leads to this message
      watchForms(msg.data.forms);
      sendResponse();
      return true;
    } else if (msg.command === "saveCipherAttemptCompleted") {
      if (!notificationBarIframe) {
        return;
      }

      notificationBarIframe.contentWindow?.postMessage(
        {
          command: "saveCipherAttemptCompleted",
          error: msg.data?.error,
          username: msg.data?.username,
          cipherId: msg.data?.cipherId,
        },
        "*",
      );
    }
  }
  // End Message Processing

  /**
   * Observe the DOM for changes and collect page details if forms are added to the page
   */
  function observeDom() {
    const bodies = document.querySelectorAll("body");
    if (bodies && bodies.length > 0) {
      observer = new MutationObserver((mutations: MutationRecord[]) => {
        // If mutation observer detects a change in the page URL, collect page details
        // which will reset the observer and start watching for new forms on the new page
        if (pageHref !== window.location.href) {
          handlePageChange();
          return;
        }

        // If mutations are not found, return
        if (mutations == null || mutations.length === 0) {
          return;
        }

        let doCollectPageDetails = false;

        for (let i = 0; i < mutations.length; i++) {
          const mutation: MutationRecord = mutations[i];

          // If there are no added nodes, continue to next mutation
          if (mutation.addedNodes == null || mutation.addedNodes.length === 0) {
            continue;
          }

          for (let j = 0; j < mutation.addedNodes.length; j++) {
            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement
            const addedNode: any = mutation.addedNodes[j];

            // If the added node is null, continue to next added node
            if (addedNode == null) {
              continue;
            }

            // Get the lowercase tag name of the added node (if it exists)
            const tagName = addedNode.tagName != null ? addedNode.tagName.toLowerCase() : null;

            // If tag name exists & is a form &
            // (either the dataset is null or it does not have the custom data attribute: "data-bitwarden-watching"),
            // then collect page details and break
            // Note: The dataset read-only property of the HTMLElement interface provides
            // read/write access to custom data attributes (data-*) on elements
            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset
            if (
              tagName != null &&
              tagName === "form" &&
              (addedNode.dataset == null || !addedNode.dataset.bitwardenWatching)
            ) {
              doCollectPageDetails = true;
              break;
            }

            // If tag name exists & is in the observeIgnoredElements set
            // or if the added node does not have the querySelectorAll method, continue to next added node
            // Note: querySelectorAll(...) exists on the Element & Document interfaces
            // It doesn't exist for nodes that are not elements, such as text nodes
            // Text Node examples: https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeName#example
            if (
              (tagName != null && observeIgnoredElements.has(tagName)) ||
              addedNode.querySelectorAll == null
            ) {
              continue;
            }

            // If the added node has any descendent form elements that are not yet being watched, collect page details and break
            const forms = addedNode.querySelectorAll("form:not([data-bitwarden-watching])");
            if (forms != null && forms.length > 0) {
              doCollectPageDetails = true;
              break;
            }
          }

          if (doCollectPageDetails) {
            break;
          }
        }

        // If page details need to be collected, clear any existing timeout and schedule a new one
        if (doCollectPageDetails) {
          if (domObservationCollectTimeoutId != null) {
            window.clearTimeout(domObservationCollectTimeoutId);
            domObservationCollectTimeoutId = null;
          }

          // The timeout is used to avoid collecting page details too often on page mutation while also
          // giving the DOM time to settle down after a change (ex: multi-part forms being rendered)
          domObservationCollectTimeoutId = window.setTimeout(collectPageDetails, 1000);
        }
      });

      // Watch all mutations to the body element and all of its children & descendants
      observer.observe(bodies[0], { childList: true, subtree: true });
    }
  }

  /**
   * Handles initial page load and page changes
   * 3 ways this method is called:
   *
   * (1) On initial content script load
   *
   * (2) On page change (detected by observer)
   *
   * (3) On after scheduled delay setup in `scheduleHandlePageChange()
   *
   * On page change, we update the page href, empty the watched forms array, call collectPageDetails (w/ 1 second timeout), and reset the observer
   */
  function handlePageChange() {
    // On first load the content script or any time the page changes, we need to collect the page details and setup the mutation observer
    if (pageHref !== window.location.href) {
      // update href
      pageHref = window.location.href;

      // Empty watched forms so it doesn't carry over between SPA page changes
      // This allows formOpIds to be unique for each page so that we can
      // associate submit buttons with their respective forms in the getSubmitButton logic.
      watchedForms.length = 0;

      // collect the page details after a timeout
      // The timeout is used to allow more time for the page to load before collecting the page details
      // as there are some cases where SPAs do not load the entire page on initial load, so we need to wait
      if (collectPageDetailsTimeoutId != null) {
        window.clearTimeout(collectPageDetailsTimeoutId);
        collectPageDetailsTimeoutId = null;
      }
      collectPageDetailsTimeoutId = window.setTimeout(collectPageDetails, 1000);

      if (observer) {
        // reset existing DOM mutation observer so it can listen for changes to the new page body
        observer.disconnect();
        observer = null;
      }

      // On first load or page change, start observing the DOM as early as possible
      // to avoid missing any forms that are added after the page loads
      observeDom();

      void sendExtensionMessage("checkNotificationQueue");
    }

    // This is a safeguard in case the observer misses a SPA page change.
    scheduleHandlePageChange();
  }

  /**
   * Set up a timeout to call handlePageChange after 1 second
   */
  function scheduleHandlePageChange() {
    // Check again in 1 second (but clear any existing timeout first)
    if (handlePageChangeTimeoutId != null) {
      window.clearTimeout(handlePageChangeTimeoutId);
      handlePageChangeTimeoutId = null;
    }
    handlePageChangeTimeoutId = window.setTimeout(handlePageChange, 1000);
  }

  /** *
   * Tell the background script to collect the page details.
   *
   * (1) Sends a message with command `bgCollectPageDetails` to `runtime.background.ts : processMessage(...)`
   *
   * (2) `runtime.background.ts : processMessage(...)` calls
   * `main.background.ts : collectPageDetailsForContentScript`
   *
   * (3) `main.background.ts : collectPageDetailsForContentScript`
   * sends a message with command `collectPageDetails` to the `autofill-init.js` content script
   *
   * (4) `autofill-init.js` content script runs a `collect(document)` method.
   * The result is sent via message with command `collectPageDetailsResponse` to `notification.background.ts : processMessage(...)`
   *
   * (5) `notification.background.ts : processMessage(...)` gathers forms with password fields and passes them and the page details
   * via message with command `notificationBarPageDetails` back to the `processMessages` method in this content script.
   *
   * */
  function collectPageDetails() {
    void sendExtensionMessage("bgCollectPageDetails", { sender: "notificationBar" });
  }

  // End Page Detail Collection Methods

  // Form Detection and Submission Handling

  /**
   * Iterates through the given array of forms and adds an event listener to each form.
   * The purpose of the event listener is to detect changes in form data and store the changes.
   *
   * Note: The forms were gathered in the `notification.background.ts : processMessage(...)`
   * method with command `collectPageDetailsResponse` by the `autofillService.getFormsWithPasswordFields(...)` method
   * and passed to the `processMessages` method in this content script.
   *
   * @param {FormData[]} forms - The array of forms to be watched.
   */
  function watchForms(forms: FormData[]) {
    // If there are no forms, return
    if (forms == null || forms.length === 0) {
      return;
    }

    forms.forEach((f: FormData) => {
      // Get the form element by id
      const formId: string = f.form != null ? f.form.htmlID : null;
      let formEl: HTMLFormElement = null;
      if (formId != null && formId !== "") {
        formEl = document.getElementById(formId) as HTMLFormElement;
      }

      // If the form could not be retrieved by its HTML ID, retrieve it by its index pulled from the opid
      if (formEl == null) {
        // opid stands for OnePassword ID - uniquely ID's an element on a page
        // and is generated in `autofill-init.js`
        // Each form has an opid and each element has an opid and its parent form opid
        const index = parseInt(f.form.opid.split("__")[2], null);
        formEl = document.getElementsByTagName("form")[index];
      }

      // If the form element exists and is not yet being watched, start watching it and set it as watched
      if (formEl != null && formEl.dataset.bitwardenWatching !== "1") {
        const watchedForm: WatchedForm = {
          data: f,
          formEl: formEl,
          usernameEl: null,
          passwordEl: null,
          passwordEls: null,
        };
        // Locate the username and password fields
        locateFields(watchedForm);
        // Add the form data to the array of watched forms
        watchedForms.push(watchedForm);
        // Add an event listener to the form
        listenToForm(formEl);
        // Set the form as watched
        formEl.dataset.bitwardenWatching = "1";
      }
    });
  }

  function listenToForm(form: HTMLFormElement) {
    // Remove any existing event listeners and re-add them
    // for form submission and submit button click
    form.removeEventListener("submit", formSubmitted, false);
    form.addEventListener("submit", formSubmitted, false);

    findAndListenToSubmitButton(form);
  }

  function findAndListenToSubmitButton(form: HTMLFormElement) {
    // Use login button names and change password names since we don't
    // know what type of form we are watching
    const submitButton = getSubmitButton(
      form,
      unionSets(logInButtonNames, changePasswordButtonNames),
    );

    if (submitButton != null) {
      submitButton.removeEventListener("click", formSubmitted, false);
      submitButton.addEventListener("click", formSubmitted, false);

      // Associate the form opid with the submit button so we can find the form on submit.
      (submitButton as HTMLElementWithFormOpId).formOpId = form.opid;
    }
  }

  /**
   * Locate the fields within a form element given form data.
   * @param {Object} watchedForm - The object containing form data and the form element to search within.
   */
  function locateFields(watchedForm: WatchedForm) {
    // Get all input elements
    const inputs = Array.from(document.getElementsByTagName("input"));

    // Locate the username field
    watchedForm.usernameEl = locateField(watchedForm.formEl, watchedForm.data.username, inputs);

    // if we found a username field, try to locate a single password field
    if (watchedForm.usernameEl != null && watchedForm.data.password != null) {
      // This is most likely a login or create account form b/c we have a username and password
      watchedForm.passwordEl = locatePassword(
        watchedForm.formEl,
        watchedForm.data.password,
        inputs,
        true, // Only do fallback if we have expect to find a single password field
      );
    } else if (watchedForm.data.passwords != null) {
      // if we didn't find a username field, try to locate multiple password fields
      // This is most likely a change password form b/c we have multiple password fields
      watchedForm.passwordEls = [];
      watchedForm.data.passwords.forEach((passwordData: AutofillField) => {
        // Note: do not do fallback here b/c we expect to find multiple password fields
        // and form.querySelector always returns the first element it finds
        const passwordEl = locatePassword(watchedForm.formEl, passwordData, inputs, false);
        if (passwordEl != null) {
          watchedForm.passwordEls.push(passwordEl);
        }
      });
      if (watchedForm.passwordEls.length === 0) {
        watchedForm.passwordEls = null;
      }
    }
  }

  function locatePassword(
    form: HTMLFormElement,
    passwordData: AutofillField,
    inputs: HTMLInputElement[],
    doLastFallback: boolean,
  ): HTMLInputElement {
    let el = locateField(form, passwordData, inputs);
    if (el != null && el.type !== "password") {
      el = null;
    }
    if (doLastFallback && el == null) {
      el = form.querySelector('input[type="password"]');
    }
    return el;
  }

  /**
   * Locate a field within a form element given field data.
   * @param {Object} form - The form element to search within.
   * @param {Object} fieldData - The field data to search for.
   * @param {Object[]} inputs - The array of input elements to search within.
   * @returns {Object} The located field element.
   */
  function locateField(
    form: HTMLFormElement,
    fieldData: AutofillField,
    inputs: HTMLInputElement[],
  ): HTMLInputElement | null {
    // If we have no field data, we cannot locate the field
    if (fieldData == null) {
      return;
    }
    // Try to locate the field by its HTML ID, by its HTML name, or finally by its element number
    let el: HTMLInputElement = null;
    if (fieldData.htmlID != null && fieldData.htmlID !== "") {
      try {
        el = form.querySelector("#" + fieldData.htmlID);
      } catch {
        // Ignore error, we perform fallbacks below.
      }
    }
    if (el == null && fieldData.htmlName != null && fieldData.htmlName !== "") {
      el = form.querySelector('input[name="' + fieldData.htmlName + '"]');
    }
    if (el == null && fieldData.elementNumber != null) {
      el = inputs[fieldData.elementNumber];
    }
    return el;
  }

  /*
   * Event handler for form submission (submit button click or form submit)
   */
  function formSubmitted(e: Event) {
    let form: HTMLFormElement = null;
    // If the event is a click event, we need to find the closest form element
    let clickedElement: HTMLElement = null;
    if (e.type === "click") {
      clickedElement = e.target as HTMLElement;

      // Set a flag on the clicked element so we don't set it as a submit button again
      if (clickedElement?.dataset?.bitwardenClicked !== "1") {
        clickedElement.dataset.bitwardenClicked = "1";
      }

      form = clickedElement.closest("form");
      // If we didn't find a form element, check if the click was within a modal
      if (form == null) {
        const parentModal = clickedElement.closest("div.modal");
        // If we found a modal, check if it has a single form element
        if (parentModal != null) {
          const modalForms = parentModal.querySelectorAll("form");
          if (modalForms.length === 1) {
            form = modalForms[0];
          }
        }
      }

      // see if the event target is a submit button with a formOpId
      const formOpId = (clickedElement as HTMLElementWithFormOpId).formOpId;
      if (form == null && formOpId != null) {
        // Find form in watched forms array via form op id
        form = watchedForms.find((wf: WatchedForm) => wf.formEl.opid === formOpId).formEl;
      }
    } else {
      // If the event is a submit event, we can get the form element from the event target
      form = e.target as HTMLFormElement;
    }

    // if we didn't find a form element or we've already processed this form, return
    if (form == null || form.dataset.bitwardenProcessed === "1") {
      return;
    }

    // Find the form in the watched forms array
    for (let i = 0; i < watchedForms.length; i++) {
      if (watchedForms[i].formEl !== form) {
        continue;
      }

      // if user has enabled either add login or change password notification, and we have a username and password field
      if (
        (enableChangedPasswordPrompt || enableAddedLoginPrompt) &&
        watchedForms[i].usernameEl != null &&
        watchedForms[i].passwordEl != null
      ) {
        // Create a login object from the form data
        const login: AddLoginMessageData = {
          username: watchedForms[i].usernameEl.value,
          password: watchedForms[i].passwordEl.value,
          url: document.URL,
        };

        // if we have values for username and password, send a message to the background script to add the login
        const userNamePopulated = login.username != null && login.username !== "";
        const passwordPopulated = login.password != null && login.password !== "";
        if (userNamePopulated && passwordPopulated) {
          processedForm(form);
          void sendExtensionMessage("bgAddLogin", { login });
          break;
        } else if (
          userNamePopulated &&
          !passwordPopulated &&
          clickedElement !== null &&
          !isElementVisible(clickedElement)
        ) {
          // Likely a multi step login form with password missing and next button no longer visible
          // Remove click listener from previous "submit" button (next button)
          clickedElement.removeEventListener("click", formSubmitted);
          findAndListenToSubmitButton(form);
        }
      }

      // if user has not disabled the password changed notification and we have multiple password fields,
      // then check if the user has changed their password
      if (enableChangedPasswordPrompt && watchedForms[i].passwordEls != null) {
        // Get the values of the password fields
        const passwords: string[] = watchedForms[i].passwordEls
          .filter((el: HTMLInputElement) => el.value != null && el.value !== "")
          .map((el: HTMLInputElement) => el.value);

        let curPass: string = null;
        let newPass: string = null;
        let newPassOnly = false;

        if (watchedForms[i].passwordEls.length === 3 && passwords.length === 3) {
          // we have 3 password fields and all 3 have values
          // Assume second field is new password.
          newPass = passwords[1];
          if (passwords[0] !== newPass && newPass === passwords[2]) {
            // first field is the current password, the second field is the new password, and the third field is the new password confirmation
            curPass = passwords[0];
          } else if (newPass !== passwords[2] && passwords[0] === newPass) {
            // first field is the new password, second field is the new password confirmation, and third field is the current password
            curPass = passwords[2];
          }
        } else if (watchedForms[i].passwordEls.length === 2 && passwords.length === 2) {
          // we have 2 password fields and both have values
          if (passwords[0] === passwords[1]) {
            // both fields have the same value, assume this is a new password
            newPassOnly = true;
            newPass = passwords[0];
            curPass = null;
          } else {
            // both fields have different values
            // Check if the submit button contains any of the change password button names as a safeguard
            const buttonText = getButtonText(getSubmitButton(form, changePasswordButtonNames));
            const matches = Array.from(changePasswordButtonContainsNames).filter(
              (n) => buttonText.indexOf(n) > -1,
            );

            if (matches.length > 0) {
              // If there is a change password button, then
              // assume first field is current password and second field is new password
              curPass = passwords[0];
              newPass = passwords[1];
            }
          }
        }

        // if we have a new password and a current password or we only have a new password
        if ((newPass != null && curPass != null) || (newPassOnly && newPass != null)) {
          // Flag the form as processed so we don't process it again
          processedForm(form);

          // Send a message to the `notification.background.ts` background script to notify the user that their password has changed
          // which eventually calls the `processMessage(...)` method in this script with command `openNotificationBar`
          const data: ChangePasswordMessageData = {
            newPassword: newPass,
            currentPassword: curPass,
            url: document.URL,
          };
          void sendExtensionMessage("bgChangedPassword", { data });
          break;
        }
      }
    }
  }

  /**
   * Gets a submit button element from a form or enclosing element
   * @param wrappingEl - the form or enclosing element
   * @param buttonNames - login button names to match against
   * @returns the submit button element
   */
  function getSubmitButton(wrappingEl: HTMLElement, buttonNames: Set<string>): HTMLElement {
    // If wrapping element doesn't exist we can't get a submit button
    if (wrappingEl == null) {
      return null;
    }

    const wrappingElIsForm = wrappingEl.tagName.toLowerCase() === "form";

    // query for submit button
    const possibleSubmitBtnSelectors = [
      'input[type="submit"]',
      'input[type="image"]',
      'button[type="submit"]',
    ];
    const submitBtnSelector = possibleSubmitBtnSelectors
      .map((btnSelector) => `${btnSelector}:not([data-bitwarden-clicked])`)
      .join(", ");
    let submitButton = wrappingEl.querySelector(submitBtnSelector) as HTMLElement;

    // if we didn't find a submit button and we are in a form:
    if (submitButton == null && wrappingElIsForm) {
      // query for a button that doesn't have the type attribute
      submitButton = wrappingEl.querySelector("button:not([type]):not([data-bitwarden-clicked])");
      if (submitButton != null) {
        // Retrieve "submit" button text because it might be a cancel button instead of a submit button.
        // If it is a cancel button, then we don't want to use it.
        const buttonText = getButtonText(submitButton);
        if (buttonText != null && cancelButtonNames.has(buttonText.trim().toLowerCase())) {
          submitButton = null;
        }
      }
    }

    // If we still don't have a submit button, then try to find a button that looks like a submit button
    if (submitButton == null) {
      const possibleSubmitButtons = Array.from(
        wrappingEl.querySelectorAll(
          'a, span, button[type="button"], ' + 'input[type="button"], button:not([type])',
        ),
      ) as HTMLElement[];
      let typelessButton: HTMLElement = null;
      // Loop through all possible submit buttons and find the first one that matches a submit button name
      possibleSubmitButtons.forEach((button) => {
        if (submitButton != null || button == null || button.tagName == null) {
          // Continue if we already found a submit button or if the button is null or doesn't have a tag name
          // Return in a forEach(...) is equivalent to continue
          return;
        }
        // Retrieve button text
        const buttonText = getButtonText(button);
        if (buttonText != null) {
          // if we have a button that doesn't have a type attribute & isn't a cancel btn,
          // then save it in case we don't find a submit button
          if (
            typelessButton != null &&
            button.tagName.toLowerCase() === "button" &&
            button.getAttribute("type") == null &&
            !cancelButtonNames.has(buttonText.trim().toLowerCase())
          ) {
            typelessButton = button;
          } else if (buttonNames.has(buttonText.trim().toLowerCase())) {
            // If the button text matches a submit button name, then use it
            submitButton = button;
          }
        }
      });
      // Fallback to typeless button if it exists and we didn't find a submit button
      if (submitButton == null && typelessButton != null) {
        submitButton = typelessButton;
      }
    }

    // If we still don't have a submit button, then try to find a submit button in a modal
    if (submitButton == null && wrappingElIsForm) {
      // Maybe it's in a modal?
      // Find closest modal and check if it has only one form
      const parentModal = wrappingEl.closest("div.modal") as HTMLElement;
      if (parentModal != null) {
        const modalForms = parentModal.querySelectorAll("form");
        if (modalForms.length === 1) {
          submitButton = getSubmitButton(parentModal, buttonNames);
        }
      }

      // If we still don't have a submit button, then try to find a submit button by using the form's
      // parent element as the wrapping element
      if (submitButton == null) {
        const parentElement = wrappingEl.parentElement;

        // Going up a level and looking for loginButtonNames
        if (parentElement != null) {
          submitButton = getSubmitButton(parentElement, buttonNames);
        }
      }
    }
    return submitButton;
  }

  /**
   * Returns the text of a given button element.
   * @param button - The button element to get the text from.
   * @returns - The text of the button.
   */
  function getButtonText(button: HTMLElement) {
    let buttonText: string = null;
    if (button.tagName.toLowerCase() === "input") {
      buttonText = (button as HTMLInputElement).value;
    } else {
      buttonText = button.innerText;
    }
    return buttonText;
  }

  /**
   * Mark form as processed so we don't try to process it again.
   * @param {Object} form - The form element to mark as processed.
   */
  function processedForm(form: HTMLFormElement) {
    form.dataset.bitwardenProcessed = "1";
    window.setTimeout(() => {
      form.dataset.bitwardenProcessed = "0";
    }, 500);
  }

  // End Form Detection and Submission Handling

  // Notification Bar Functions (open, close, height adjustment, etc.)
  function closeExistingAndOpenBar(type: string, typeData: NotificationTypeData) {
    const notificationBarInitData: NotificationBarIframeInitData = {
      type,
      isVaultLocked: typeData.isVaultLocked,
      theme: typeData.theme,
      removeIndividualVault: typeData.removeIndividualVault,
      importType: typeData.importType,
    };
    const notificationBarUrl = "notification/bar.html";

    const frame = document.getElementById("bit-notification-bar-iframe") as HTMLIFrameElement;
    if (frame != null && frame.src.indexOf(notificationBarUrl) >= 0) {
      return;
    }

    closeBar(false);
    void openBar(type, notificationBarUrl, notificationBarInitData);
  }

  async function openBar(
    type: string,
    barPage: string,
    notificationBarInitData: NotificationBarIframeInitData,
  ) {
    barType = type;

    if (document.body == null) {
      return;
    }
    const useComponentBar: boolean = await sendExtensionMessage("notificationRefreshFlagValue");

    setupInitNotificationBarMessageListener(notificationBarInitData);
    const barPageUrl: string = chrome.runtime.getURL(barPage);

    function getIframeStyle(useComponentBar: boolean): string {
      return (
        (useComponentBar
          ? "height: calc(276px + 25px); width: 450px; right: 0;"
          : "height: 42px; width: 100%;") + " border: 0; min-height: initial;"
      );
    }

    notificationBarIframe = document.createElement("iframe");
    notificationBarIframe.style.cssText = getIframeStyle(useComponentBar);
    notificationBarIframe.id = "bit-notification-bar-iframe";
    notificationBarIframe.src = barPageUrl;

    function getFrameStyle(useComponentBar: boolean): string {
      return (
        (useComponentBar
          ? "height: calc(276px + 25px); width: 450px; right: 0;"
          : "height: 42px; width: 100%; left: 0;") +
        " top: 0; padding: 0; position: fixed;" +
        " z-index: 2147483647; visibility: visible;"
      );
    }

    const frameDiv = document.createElement("div");
    frameDiv.setAttribute("aria-live", "polite");
    frameDiv.id = "bit-notification-bar";
    frameDiv.style.cssText = getFrameStyle(useComponentBar);
    frameDiv.appendChild(notificationBarIframe);
    document.body.appendChild(frameDiv);

    (notificationBarIframe.contentWindow.location as any) = barPageUrl;
  }

  function setupInitNotificationBarMessageListener(initData: NotificationBarIframeInitData) {
    const handleInitNotificationBarMessage = (event: MessageEvent) => {
      const { source, data } = event;
      if (
        source !== notificationBarIframe.contentWindow ||
        data?.command !== "initNotificationBar"
      ) {
        return;
      }

      notificationBarIframe.contentWindow.postMessage(
        { command: "initNotificationBar", initData },
        "*",
      );
      injectSpacer();
      window.removeEventListener("message", handleInitNotificationBarMessage);
    };

    window.addEventListener("message", handleInitNotificationBarMessage);
  }

  function injectSpacer() {
    const spacer = document.createElement("div");
    spacer.id = "bit-notification-bar-spacer";
    spacer.style.cssText = "height: 42px;";
    document.body.insertBefore(spacer, document.body.firstChild);
  }

  function closeBar(explicitClose: boolean) {
    const barEl = document.getElementById("bit-notification-bar");
    if (barEl != null) {
      barEl.parentElement.removeChild(barEl);
      notificationBarIframe = null;
    }

    const spacerEl = document.getElementById("bit-notification-bar-spacer");
    if (spacerEl) {
      spacerEl.parentElement.removeChild(spacerEl);
    }

    if (!explicitClose) {
      return;
    }

    switch (barType) {
      case "add":
      case "change":
        void sendExtensionMessage("bgRemoveTabFromNotificationQueue");
        break;
      default:
        break;
    }
  }

  function adjustBar(data: any) {
    if (data != null && data.height !== 42) {
      const newHeight = data.height + "px";
      doHeightAdjustment("bit-notification-bar-iframe", newHeight);
      doHeightAdjustment("bit-notification-bar", newHeight);
      doHeightAdjustment("bit-notification-bar-spacer", newHeight);
    }
  }

  function doHeightAdjustment(elId: string, heightStyle: string) {
    const el = document.getElementById(elId);
    if (el != null) {
      el.style.height = heightStyle;
    }
  }
  // End Notification Bar Functions (open, close, height adjustment, etc.)

  // Helper Functions
  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  // https://stackoverflow.com/a/41328397/20715409 - most efficient of the answers there
  function unionSets(...iterables: Set<any>[]): Set<any> {
    const set = new Set();

    for (const iterable of iterables) {
      for (const item of iterable) {
        set.add(item);
      }
    }

    return set;
  }

  /**
   * Determine if the element is visible.
   * Visible is define as not having `display: none` or `visibility: hidden`.
   * @param {HTMLElement} el
   * @returns {boolean} Returns `true` if the element is visible and `false` otherwise
   *
   * Copied from autofill-init.js and converted to TypeScript;
   * TODO: could be refactored to be in a shared location if autofill-init.js is converted to TS
   */
  function isElementVisible(el: HTMLElement): boolean {
    let theEl: Node | null = el;
    // Get the top level document
    const elDocument = el.ownerDocument;
    const elWindow = elDocument ? elDocument.defaultView : undefined;

    // walk the dom tree until we reach the top
    while (theEl && theEl !== document) {
      // Calculate the style of the element
      const elStyle = elWindow?.getComputedStyle
        ? elWindow.getComputedStyle(theEl as HTMLElement, null)
        : (theEl as HTMLElement).style;

      // If there's no computed style at all, we're done, as we know that it's not hidden
      if (!elStyle) {
        return true;
      }

      // If the element's computed style includes `display: none` or `visibility: hidden`, we know it's hidden
      if ("none" === elStyle.display || "hidden" === elStyle.visibility) {
        return false;
      }

      // At this point, we aren't sure if the element is hidden or not, so we need to keep walking up the tree
      theEl = theEl.parentNode;
    }

    // If we've reached the top of the tree, we know that the element is visible
    return theEl === document;
  }

  function handleExtensionDisconnection(port: chrome.runtime.Port) {
    closeBar(false);
    clearTimeout(domObservationCollectTimeoutId);
    clearTimeout(collectPageDetailsTimeoutId);
    clearTimeout(handlePageChangeTimeoutId);
    observer?.disconnect();
    observer = null;
    watchedForms.forEach((wf: WatchedForm) => {
      const form = wf.formEl;
      form.removeEventListener("submit", formSubmitted, false);
      const submitButton = getSubmitButton(
        form,
        unionSets(logInButtonNames, changePasswordButtonNames),
      );
      submitButton?.removeEventListener("click", formSubmitted, false);
    });
  }

  // End Helper Functions
}
