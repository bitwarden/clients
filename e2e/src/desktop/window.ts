import { ElectronApplication } from "@playwright/test";

// Wide enough for the side nav to push the content aside (libs/components layout). Narrower,
// as at the app's default 950 px, it opens as an overlay drawer, which onboarding opens on its
// own and which then disturbs whatever dialog is open, e.g. an approval prompt.
const WIDTH = 1280;
const HEIGHT = 900;

/** Resizes the app window so the side nav never overlays a dialog the test is answering. */
export async function useWideWindow(app: ElectronApplication) {
  await app.evaluate(
    ({ BrowserWindow }, [width, height]) => BrowserWindow.getAllWindows()[0].setSize(width, height),
    [WIDTH, HEIGHT],
  );
}
