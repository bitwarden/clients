
import { MockProxy, mock } from 'jest-mock-extended';

import { ApiService } from '@bitwarden/common/abstractions/api.service';
import { DefaultTaskSchedulerService, TaskSchedulerService } from '@bitwarden/common/platform/scheduling';
import { FakeGlobalStateProvider } from '@bitwarden/common/spec';
import { LogService } from '@bitwarden/logging';

import { PhishingDataService, PhishingData, PHISHING_DOMAINS_KEY } from './phishing-data.service';

describe('PhishingDataService', () => {
    let service: PhishingDataService;
    let apiService: MockProxy<ApiService>;
    let taskSchedulerService: TaskSchedulerService;
    let logService: MockProxy<LogService>;
    const stateProvider: FakeGlobalStateProvider = new FakeGlobalStateProvider();
    const setMockState = (state: PhishingData) => {
        stateProvider.getFake(PHISHING_DOMAINS_KEY).stateSubject.next(state);
    }

    beforeEach(() => {
        jest.useFakeTimers();
        apiService = mock();
        logService = mock<LogService>();
        taskSchedulerService = new DefaultTaskSchedulerService(logService);

        service = new PhishingDataService(
            apiService,
            taskSchedulerService,
            stateProvider,
            logService
        );
    });

    it('should detect a phishing domain', async () => {
        setMockState({
            domains: ['phish.com', 'badguy.net'],
            timestamp: Date.now(),
            checksum: 'abc123',
        })
        const url = new URL('http://phish.com');
        const result = await service.isPhishingDomain(url);
        expect(result).toBe(true);
    });


    it('should not detect a safe domain', async () => {
        setMockState({
            domains: ['phish.com', 'badguy.net'],
            timestamp: Date.now(),
            checksum: 'abc123',
        })
        const url = new URL('http://safe.com');
        const result = await service.isPhishingDomain(url);
        expect(result).toBe(false);
    });

    it('should match against root domain', async () => {
        setMockState({
            domains: ['phish.com', 'badguy.net'],
            timestamp: Date.now(),
            checksum: 'abc123',
        })
        const url = new URL('http://phish.com/about');
        const result = await service.isPhishingDomain(url);
        expect(result).toBe(true);
    });

    it('should not error on missing state', async () => {
        setMockState(undefined as any)
        const url = new URL('http://phish.com/about');
        const result = await service.isPhishingDomain(url);
        expect(result).toBe(false);
    })

    it('should only fetch data on new checksum', async () => {
        
    })

    // it('should retry on error', async () => {
    //     apiService.nativeFetch.mockRejectedValueOnce(new Error('fail 1'));
    //     apiService.nativeFetch.mockRejectedValueOnce(new Error('fail 2'));
    //     apiService.nativeFetch.mockResolvedValueOnce({ text: async () => 'phish.com\nbadguy.net' } as any);

    //     // Start the initialize process (which triggers the update and retry logic)
    //     const initPromise = service.initialize();

    //     // Advance timers for each retry interval (assuming 3 retries)
    //     for (let i = 0; i < 2; i++) {
    //         jest.advanceTimersByTime(service.RETRY_INTERVAL_DURATION);
    //         // Let RxJS flush microtasks
    //         await Promise.resolve();
    //     }

    //     await initPromise;

    //     expect(logService.error).toHaveBeenCalled();
    //     expect(apiService.nativeFetch).toHaveBeenCalledTimes(3);
    // });
});
