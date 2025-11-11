import * as fs from "fs";
import * as path from "path";

import { Browser, Page, test, TestFixture } from "@playwright/test";
import { webServerBaseUrl } from "@playwright-config";
import * as playwright from "playwright";
// Playwright doesn't expose this type, so we duplicate it here
type BrowserName = "chromium" | "firefox" | "webkit";

import { Play, SingleUserScene, SingleUserSceneTemplate } from "@bitwarden/playwright-helpers";

import { addInitScriptForPlayId } from "./page-extension";

const hostname = new URL(webServerBaseUrl).hostname;
const dataDir = process.env.PLAYWRIGHT_DATA_DIR ?? "playwright-data";
// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function dataFilePath(mangledEmail: string): string {
  return path.join(dataDir, `auth-${mangledEmail}.json`);
}
function sessionFilePath(mangledEmail: string): string {
  return path.join(dataDir, `session-${mangledEmail}.json`);
}
function localFilePath(mangledEmail: string): string {
  return path.join(dataDir, `local-${mangledEmail}.json`);
}

type AuthedUserData = {
  email: string;
  password: string;
  scene: SingleUserScene;
};

type AuthenticatedContext = {
  /** The Playwright page we authenticated */
  page: Page;
  /** The Scene used to authenticate */
  scene: SingleUserScene;
};

/**
 * A map of already authenticated emails to their scenes.
 */
const AuthenticatedEmails = new Map<string, AuthedUserData>();

export class AuthFixture {
  private _browser!: Browser;
  private _page!: Page;

  constructor(private readonly browserName: BrowserName) {}

  static fixtureValue(): TestFixture<AuthFixture, { browserName: BrowserName }> {
    return async ({ browserName }, use) => {
      const auth = new AuthFixture(browserName as BrowserName);
      await auth.init();
      await use(auth);
      await auth.close();
    };
  }

  async init(): Promise<void> {
    if (!this._browser) {
      this._browser = await playwright[this.browserName].launch();
    }
  }

  async close(): Promise<void> {
    if (this._browser) {
      await this._browser.close();
      this._browser = undefined!;
    }
  }

  async page(): Promise<Page> {
    if (!this._page) {
      if (!this._browser) {
        await this.init();
      }
      const context = await this._browser.newContext();
      this._page = await context.newPage();
      await addInitScriptForPlayId(this._page, process.env.PLAY_ID!);
    }
    return this._page;
  }

  /**
   * Creates a testing {@link Scene} with a user and a {@link Page} authenticated as that user.
   * If the user has already been authenticated in this worker, it will reuse the existing session,
   * but the pages are independent.
   *
   * @param email email of the user
   * @param password password of the user
   * @returns The authenticated page and scene used to scaffold the user
   */
  async authenticate(email: string, password: string): Promise<AuthenticatedContext> {
    if (AuthenticatedEmails.has(email)) {
      return await this.resumeSession(email, password);
    }

    // start a new session
    return await this.newSession(email, password);
  }

  async resumeSession(email: string, password: string): Promise<AuthenticatedContext> {
    const page = await this.page();
    if (AuthenticatedEmails.get(email)!.password !== password) {
      throw new Error(
        `Email ${email} is already authenticated with a different password (${
          AuthenticatedEmails.get(email)!.password
        })`,
      );
    }
    const scene = AuthenticatedEmails.get(email)!.scene;
    const mangledEmail = scene.mangle(email);
    await page.context().storageState({ path: dataFilePath(mangledEmail) });

    if (!fs.existsSync(sessionFilePath(mangledEmail))) {
      throw new Error("No session file found");
    }

    // Load stored state and session into a new page
    await loadLocal(page, mangledEmail);
    await loadSession(page, mangledEmail);

    await page.goto("/#/");

    return {
      page,
      scene,
    };
  }

  async newSession(email: string, password: string): Promise<AuthenticatedContext> {
    const page = await this.page();
    const scene = await Play.scene(new SingleUserSceneTemplate({ email }));
    const mangledEmail = scene.mangle(email);
    await page.goto("/#/login");

    await page
      .getByRole("textbox", { name: "Email address (required)" })
      .fill(scene.mangle("test@example.com"));
    await page.getByRole("textbox", { name: "Email address (required)" }).press("Enter");
    await page
      .getByRole("textbox", { name: "Master password (required)" })
      .fill(scene.mangle("asdfasdfasdf"));
    await page.getByRole("button", { name: "Log in with master password" }).click();
    await page.getByRole("button", { name: "Add it later" }).click();
    await page.getByRole("link", { name: "Skip to web app" }).click();

    // Store the scene for future use
    AuthenticatedEmails.set(email, { email, password, scene });

    // Save storage state to avoid logging in again
    await saveLocal(page, mangledEmail);
    await saveSession(page, mangledEmail);

    return { page, scene };
  }
}

async function saveSession(page: Page, mangledEmail: string): Promise<void> {
  // Get session storage and store as env variable
  const json = await page.evaluate(() => JSON.stringify(sessionStorage));
  fs.writeFileSync(sessionFilePath(mangledEmail), json, "utf-8");
}

async function loadSession(page: Page, mangledEmail: string): Promise<void> {
  if (!fs.existsSync(sessionFilePath(mangledEmail))) {
    throw new Error("No session file found");
  }
  // Set session storage in a new context
  const sessionStorage = JSON.parse(fs.readFileSync(sessionFilePath(mangledEmail), "utf-8"));
  await page.addInitScript(
    ({ storage, hostname }) => {
      if (window.location.hostname === hostname) {
        for (const [key, value] of Object.entries(storage)) {
          window.sessionStorage.setItem(key, value as any);
        }
      }
    },
    { storage: sessionStorage, hostname: hostname },
  );
}

async function saveLocal(page: Page, mangledEmail: string): Promise<void> {
  // Get session storage and store as env variable
  const json = await page.evaluate(() => JSON.stringify(localStorage));
  fs.writeFileSync(localFilePath(mangledEmail), json, "utf-8");
}

async function loadLocal(page: Page, mangledEmail: string): Promise<void> {
  if (!fs.existsSync(localFilePath(mangledEmail))) {
    throw new Error("No local file found");
  }
  // Set session storage in a new context
  const localStorage = JSON.parse(fs.readFileSync(localFilePath(mangledEmail), "utf-8"));
  await page.addInitScript(
    ({ storage, hostname }) => {
      if (window.location.hostname === hostname) {
        for (const [key, value] of Object.entries(storage)) {
          window.localStorage.setItem(key, value as any);
        }
      }
    },
    { storage: localStorage, hostname: hostname },
  );
}

test.afterAll(async () => {
  // clean up all the saved data files
  for (const { email, scene } of AuthenticatedEmails.values()) {
    const mangledEmail = scene.mangle(email);
    const dataPath = dataFilePath(mangledEmail);
    if (fs.existsSync(dataPath)) {
      fs.unlinkSync(dataPath);
    }
    const sessionPath = sessionFilePath(mangledEmail);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
    const localPath = localFilePath(mangledEmail);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
});
