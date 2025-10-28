import { catchError, EMPTY, firstValueFrom, from, map, Observable, retry, Subject, Subscription, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ScheduledTaskName, ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { GlobalStateProvider, KeyDefinition, PHISHING_DETECTION_DISK } from "@bitwarden/state";
import { LogService } from "@bitwarden/logging";
import { devFlagEnabled, devFlagValue } from "@bitwarden/browser/platform/flags";

export type PhishingData = {
    domains: string[];
    timestamp: number;
    checksum: string;
};

const interval$ = (taskSchedulerService: TaskSchedulerService, scheduledTaskName: ScheduledTaskName, msDuration: number) => {
    const _timer$ = new Subject<void>();

    taskSchedulerService.registerTaskHandler(scheduledTaskName, () => {
        _timer$.next();
    });

    return new Observable<void>((subscriber) => {
        // Schedule the task and keep the subscription
        const taskSub: Subscription = taskSchedulerService.setInterval(scheduledTaskName, msDuration);

        // Forward emissions from the subject to the subscriber
        const timerSub = _timer$.subscribe({
            next: () => {
                subscriber.next();
            },
            complete: () => {
                subscriber.complete();
            }
        });

        // Cleanup: unsubscribe from both the scheduled task and the subject
        return () => {
            taskSub.unsubscribe();
            timerSub.unsubscribe();
        };
    });
}

export const PHISHING_DOMAINS_KEY = new KeyDefinition<PhishingData>(PHISHING_DETECTION_DISK, "phishingDomains", {
    deserializer: (value: PhishingData) => value ?? { domains: [], timestamp: 0, checksum: "" },
})

export class PhishingDataService {
    private static readonly RemotePhishingDatabaseUrl =
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt";
    private static readonly RemotePhishingDatabaseChecksumUrl =
        "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-domains-ACTIVE.txt.md5";
    private static readonly RemotePhishingDatabaseTodayUrl = 
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-domains-NEW-today.txt"

    private testDomains = this.getTestDomains();
    private _cachedState = this.globalStateProvider.get(PHISHING_DOMAINS_KEY);
    private _domains$ = this._cachedState.state$.pipe(
        map(state => new Set(
            (state?.domains ?? [])
                .concat(this.testDomains)
        ))
    )

    readonly UPDATE_INTERVAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private _updateInterval$ = interval$(
        this.taskSchedulerService,
        ScheduledTaskNames.phishingDomainUpdate,
        this.UPDATE_INTERVAL_DURATION
    );

    readonly RETRY_INTERVAL_DURATION = 5 * 60 * 1000; // 5 minutes
    private _retryInterval$ = interval$(
        this.taskSchedulerService,
        ScheduledTaskNames.phishingDomainUpdate,
        this.RETRY_INTERVAL_DURATION
    );

    constructor(
        private apiService: ApiService,
        private taskSchedulerService: TaskSchedulerService,
        private globalStateProvider: GlobalStateProvider,
        private logService: LogService
    ) { }

    async initialize() {
        await firstValueFrom(this.updateDomainsWithRetry$());

        this._updateInterval$.pipe(
            switchMap(() => this.updateDomainsWithRetry$()),
        ).subscribe();
    }

    /**
     * Checks if the given URL is a known phishing domain
     *
     * @param url The URL to check
     * @returns True if the URL is a known phishing domain, false otherwise
     */
    async isPhishingDomain(url: URL): Promise<boolean> {
        const domains = await firstValueFrom(this._domains$);
        const result = domains.has(url.hostname);
        if (result) {
            this.logService.debug("[PhishingDetectionService] Caught phishing domain:", url.hostname);
            return true;
        }
        return false;
    }

    private async updateDomains(): Promise<PhishingData> {
        const prev = (await firstValueFrom(this._cachedState.state$)) ?? { domains: [], timestamp: 0, checksum: "" };
        const timestamp = Date.now();
        const prevAge = timestamp - prev.timestamp;

        // update should not have been called
        if (prevAge < this.UPDATE_INTERVAL_DURATION) {
            this.logService.info(`[PhishingDetectionService] Remote checksum matches local checksum, aborting fetch. Total domains: ${prev.domains.length}`,);
            return prev;
        }

        // If checksum matches, return previous data with new timestamp
        const remoteChecksum = await this.fetchPhishingDomainsChecksum();
        if (remoteChecksum && prev.checksum === remoteChecksum) {
            this.logService.info(`[PhishingDetectionService] Remote checksum matches local checksum, aborting fetch. Total domains: ${prev.domains.length}`,);
            return { ...prev, timestamp };
        }

        // Fetch only new domains from remote
        const isOneDayOldMax = prevAge <= 24 * 60 * 60 * 1000;
        if (isOneDayOldMax) {
            const dailyDomains: string[] = await this.fetchPhishingDomains(PhishingDataService.RemotePhishingDatabaseTodayUrl);
            this.logService.info(`[PhishingDetectionService] ${dailyDomains} new phishing domains added`);
            return { 
                domains: prev.domains.concat(dailyDomains), 
                checksum: remoteChecksum,
                timestamp
            }
        }

        // Fetch all domains from remote
        const domains = await this.fetchPhishingDomains(PhishingDataService.RemotePhishingDatabaseUrl);
        const newData: PhishingData = {
            domains,
            timestamp,
            checksum: remoteChecksum ?? "",
        };

        // todo, early returns miss the cached state update
        await this._cachedState.update(() => newData);
        this.logService.info(
            `[PhishingDetectionService] ${domains.length} domains updated`,
        );

        return newData;
    }

    private updateDomainsWithRetry$(): Observable<PhishingData> {
        return from(this.updateDomains()).pipe(
            retry({
                count: 3,
                delay: (err, count) => {
                    this.logService.error(`[PhishingDetectionService] Unable to update domains. Attempt ${count}.`, err);
                    return this._retryInterval$;
                },
                resetOnSuccess: true
            }),
            catchError(err => {
                this.logService.error("[PhishingDetectionService] Unable to update domains.", err);
                return EMPTY;
            })
        );
    }

    private async fetchPhishingDomainsChecksum() {
        return this.apiService.nativeFetch(new Request(PhishingDataService.RemotePhishingDatabaseChecksumUrl))
            .then(res => res.text());
    }

    private async fetchPhishingDomains(url: string) {
        return this.apiService
            .nativeFetch(new Request(url))
            .then((res) => res.text())
            .then((text) => text.split("\n"));
    }

    private getTestDomains() {
        const flag = devFlagEnabled("testPhishingUrls");
        if (!flag) {
            return [];
        }

        const domains = devFlagValue("testPhishingUrls") as unknown[];
        if (domains && domains instanceof Array) {
            this.logService.debug(
                "[PhishingDetectionService] Dev flag enabled for testing phishing detection. Adding test phishing domains:",
                domains,
            );
            return domains as string[];
        }
        return [];
    }
}