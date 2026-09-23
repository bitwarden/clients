import "@bitwarden/ui-common/setup-jest";
import { addCustomMatchers } from "@bitwarden/common/spec";

addCustomMatchers();

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

// jsdom does not provide IntersectionObserver; content-script services
// allocate one at construction time. observe() invokes the supplied
// callback on the next microtask with a minimal entry derived from the
// target's bounding rect so async consumers (e.g. the autofill overlay
// service) progress past the observer-based rect query.
class IntersectionObserverMock {
  private readonly callback: (entries: any[], observer: IntersectionObserverMock) => void;
  root: Element | Document | null = null;
  rootMargin = "";
  thresholds: number[] = [];

  constructor(callback: (entries: any[], observer: IntersectionObserverMock) => void) {
    this.callback = callback;
  }

  observe = jest.fn((target: Element) => {
    const rect =
      typeof target.getBoundingClientRect === "function" ? target.getBoundingClientRect() : null;
    // Promise microtasks are not faked by jest.useFakeTimers(), unlike
    // queueMicrotask/setImmediate. Tests that opt into fake timers still
    // see the callback fire so observer-based async chains progress.
    void Promise.resolve().then(() => {
      this.callback(
        [
          {
            target,
            boundingClientRect: rect,
            intersectionRect: rect,
            intersectionRatio: rect ? 1 : 0,
            isIntersecting: !!rect,
            rootBounds: null,
            time: Date.now(),
          },
        ],
        this,
      );
    });
  });
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
}
(global as any).IntersectionObserver = IntersectionObserverMock;

// jsdom implements no `CSS` interface, and the webmapper selector generator escapes
// element ids with `CSS.escape`. Implementing the real CSSOM algorithm rather than an
// identity stub keeps a test from passing on an id a browser would have escaped.
// https://drafts.csswg.org/cssom/#serialize-an-identifier
const isDigit = (code: number) => code >= 0x0030 && code <= 0x0039;
const isControl = (code: number) => (code >= 0x0001 && code <= 0x001f) || code === 0x007f;
const isNameCodePoint = (code: number) =>
  code >= 0x0080 ||
  code === 0x002d ||
  code === 0x005f ||
  isDigit(code) ||
  (code >= 0x0041 && code <= 0x005a) ||
  (code >= 0x0061 && code <= 0x007a);

function serializeIdentifier(value: string): string {
  const input = String(value);
  const leadingHyphen = input.charCodeAt(0) === 0x2d;
  let out = "";

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    const char = input.charAt(i);
    const wouldStartIdentifier = isDigit(code) && (i === 0 || (i === 1 && leadingHyphen));

    if (code === 0x0000) {
      out += "�";
    } else if (isControl(code) || wouldStartIdentifier) {
      out += `\\${code.toString(16)} `; // trailing space terminates a hex escape
    } else if (leadingHyphen && input.length === 1) {
      out += `\\${char}`;
    } else if (isNameCodePoint(code)) {
      out += char;
    } else {
      out += `\\${char}`;
    }
  }

  return out;
}

const cssGlobal = ((global as any).CSS ??= {});
cssGlobal.escape ??= serializeIdentifier;

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
