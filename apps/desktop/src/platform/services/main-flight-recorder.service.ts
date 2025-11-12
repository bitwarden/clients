import { ipcMain } from "electron";

import { MemoryFlightRecorderService } from "@bitwarden/logging";

export class MainFlightRecorderService extends MemoryFlightRecorderService {
    constructor() {
        super();

        ipcMain.handle("flightrecorder.write", async (_event, message: string) => {
            console.log("MainFlightRecorderService.write:", message);
            await this.write(message);
        });
        ipcMain.handle("flightrecorder.getRecords", async () => {
            console.log("MainFlightRecorderService.getRecords");
            return await this.getRecords();
        });
    }
}
