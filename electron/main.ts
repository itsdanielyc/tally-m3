// The main process: the "backend" of this app, the way Rust is in the Tauri
// template. It answers the bridge's IPC calls. The greeting is implemented
// here on its own, not imported from contracts/, so the real-shell suite
// (tests/e2e) is what holds it to the contract.
import { app, BrowserWindow, ipcMain, dialog, session, type IpcMainInvokeEvent } from "electron";
import { mkdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { channels } from "./bridge";
import type { CsvMapping, LedgerCommand } from "../contracts/ledger";
import { LedgerService } from "../domain/service";
import { FileLedgerStore } from "./ledger-store";
import { readCsvSource } from "./csv-io";

const WINDOW_SIZE = { width: 1120, height: 780, minWidth: 640, minHeight: 500 };
const isolatedTest = !app.isPackaged && process.env.TALLY_TEST_MODE === "1";
const TEST_ROOT = resolve(process.cwd(), ".cache");

/** Keep all test overrides inside the repository; normal app paths are owned by native dialogs. */
function isolatedPath(source: string): string {
  const path = resolve(source);
  if (!path.startsWith(`${TEST_ROOT}${sep}`)) throw new Error("Test paths must stay inside this repository's .cache directory.");
  return path;
}

if (isolatedTest) {
  const testDirectory = isolatedPath(process.env.TALLY_DATA_DIR ?? join(TEST_ROOT, "electron-data"));
  mkdirSync(testDirectory, { recursive: true });
  app.setPath("userData", testDirectory);
}
const ownsLedger = app.requestSingleInstanceLock();
if (!ownsLedger) app.quit();



/** Only the application window's top frame may invoke the local-file bridge. */
function assertTrustedFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error("Untrusted ledger frame.");
}

async function openCsvFile(): Promise<string | null> {
  const preset = isolatedTest ? process.env.TALLY_TEST_IMPORT_PATH : undefined;
  if (preset) return readCsvSource(isolatedPath(preset));
  const selection = await dialog.showOpenDialog({ title: "Import a bank CSV", filters: [{ name: "CSV files", extensions: ["csv"] }], properties: ["openFile"] });
  if (selection.canceled || !selection.filePaths[0]) return null;
  return readCsvSource(selection.filePaths[0]);
}

function createWindow(): void {
  const win = new BrowserWindow({
    ...WINDOW_SIZE,
    title: "Tally",
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  if (!ownsLedger) return;
  const ledger = await LedgerService.open(new FileLedgerStore(join(app.getPath("userData"), "ledger.json")));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const remote = /^https?:/.test(details.url);
    const localDev = !app.isPackaged && /^http:\/\/(127\.0\.0\.1|localhost):17241\//.test(details.url);
    callback({ cancel: remote && !localDev });
  });
  ipcMain.handle(channels.ledgerRead, (event) => { assertTrustedFrame(event); return ledger.read(); });
  ipcMain.handle(channels.ledgerExecute, (event, command: unknown) => { assertTrustedFrame(event); return ledger.execute(command as LedgerCommand); });
  ipcMain.handle(channels.ledgerPreview, (event, source: unknown, mapping: unknown) => { assertTrustedFrame(event); return ledger.previewCsv(source as string, mapping as CsvMapping); });
  ipcMain.handle(channels.ledgerOpenCsv, (event) => { assertTrustedFrame(event); return openCsvFile(); });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error: unknown) => {
  dialog.showErrorBox("Tally could not open the ledger", error instanceof Error ? error.message : String(error));
  app.quit();
});
app.on("second-instance", () => { const window = BrowserWindow.getAllWindows()[0]; window?.show(); window?.focus(); });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
