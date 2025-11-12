import { FlightRecorderService } from "./flight-recorder.service";

export class MemoryFlightRecorderService extends FlightRecorderService {
    private readonly records: string[] = [];

    async write(message: string): Promise<void> {
        this.records.push(message);
    }

    async getRecords(): Promise<string[]> {
        return this.records;
    }
}