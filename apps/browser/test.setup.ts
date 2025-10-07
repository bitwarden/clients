import "@bitwarden/ui-common/setup-jest";
import failOnConsole from "jest-fail-on-console";

import { addCustomMatchers } from "@bitwarden/common/spec";

addCustomMatchers();
failOnConsole();

// Add chrome storage api
const QUOTA_BYTES = 10;
const storage = {
  local: {
    set: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
    QUOTA_BYTES,
    getBytesInUse: jest.fn(),
    clear: jest.fn(),
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  session: {
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    remove: jest.fn(),
  },
};

const runtime = {
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  sendMessage: jest.fn(),
  getManifest: jest.fn(() => ({ version: 2 })),
  getURL: jest.fn((path) => `chrome-extension://id/${path}`),
  connect: jest.fn(),
  onConnect: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  reload: jest.fn(),
};

const contextMenus = {
  create: jest.fn(),
  removeAll: jest.fn(),
};

const i18n = {
  getMessage: jest.fn(),
  getUILanguage: jest.fn(),
};

const tabs = {
  get: jest.fn(),
  executeScript: jest.fn(),
  sendMessage: jest.fn(),
  query: jest.fn(),
  onActivated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onReplaced: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onRemoved: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
};

const scripting = {
  executeScript: jest.fn(),
  registerContentScripts: jest.fn(),
  unregisterContentScripts: jest.fn(),
  ExecutionWorld: { ISOLATED: "ISOLATED", MAIN: "MAIN" },
};

const windows = {
  create: jest.fn(),
  get: jest.fn(),
  getCurrent: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  onFocusChanged: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
};

const port = {
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  postMessage: jest.fn(),
};

const privacy = {
  services: {
    autofillAddressEnabled: {
      get: jest.fn(),
      set: jest.fn(),
    },
    autofillCreditCardEnabled: {
      get: jest.fn(),
      set: jest.fn(),
    },
    passwordSavingEnabled: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

const extension = {
  getBackgroundPage: jest.fn(),
  getViews: jest.fn(),
};

const offscreen = {
  createDocument: jest.fn(),
  closeDocument: jest.fn((callback) => {
    if (callback) {
      callback();
    }
  }),
  Reason: {
    CLIPBOARD: "clipboard",
  },
};

const permissions = {
  contains: jest.fn((permissions, callback) => {
    callback(true);
  }),
};

const webNavigation = {
  getFrame: jest.fn(),
  getAllFrames: jest.fn(),
  onCommitted: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onCompleted: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
};

const webRequest = {
  onBeforeRequest: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onBeforeRedirect: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  onCompleted: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
};

const alarms = {
  clear: jest.fn().mockImplementation((_name, callback) => callback(true)),
  clearAll: jest.fn().mockImplementation((callback) => callback(true)),
  create: jest.fn().mockImplementation((_name, _createInfo, callback) => callback()),
  get: jest.fn().mockImplementation((_name, callback) => callback(null)),
  getAll: jest.fn().mockImplementation((callback) => callback([])),
  onAlarm: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
};

// set chrome
global.chrome = {
  i18n,
  storage,
  runtime,
  contextMenus,
  tabs,
  scripting,
  windows,
  port,
  privacy,
  extension,
  offscreen,
  permissions,
  webNavigation,
  webRequest,
  alarms,
} as any;
