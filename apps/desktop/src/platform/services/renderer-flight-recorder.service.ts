import { FlightRecorderService } from "@bitwarden/logging";


export class RendererFlightRecorderService extends FlightRecorderService {
    async write(message: string): Promise<void> {
        console.log("RendererFlightRecorderService.write:", message);
        await ipc.platform.flightRecorder.write(message);
    }

    async getRecords(): Promise<string[]> {
        return await ipc.platform.flightRecorder.getRecords();
    }
}