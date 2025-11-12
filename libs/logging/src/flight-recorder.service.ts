export abstract class FlightRecorderService {
    abstract write(message: string): Promise<void>;
    abstract getRecords(): Promise<string[]>;
}
