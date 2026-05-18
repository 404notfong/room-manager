import { toLocalDateKey, startOfLocalDay, daysBetween } from './date-keys';

describe('toLocalDateKey', () => {
    it('formats date as YYYY-MM-DD using local timezone', () => {
        expect(toLocalDateKey(new Date(2026, 4, 18))).toBe('2026-05-18');
        expect(toLocalDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
        expect(toLocalDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
});

describe('startOfLocalDay', () => {
    it('zeros hours, minutes, seconds, ms', () => {
        const d = startOfLocalDay(new Date(2026, 4, 18, 23, 59, 59, 999));
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
        expect(d.getSeconds()).toBe(0);
        expect(d.getMilliseconds()).toBe(0);
        expect(d.getDate()).toBe(18);
    });
});

describe('daysBetween', () => {
    it('returns positive delta for future', () => {
        const today = new Date(2026, 4, 18);
        const future = new Date(2026, 4, 25);
        expect(daysBetween(today, future)).toBe(7);
    });
    it('returns negative delta for past', () => {
        const today = new Date(2026, 4, 18);
        const past = new Date(2026, 4, 11);
        expect(daysBetween(today, past)).toBe(-7);
    });
    it('returns 0 for same day even with different times', () => {
        expect(daysBetween(new Date(2026, 4, 18, 0, 0), new Date(2026, 4, 18, 23, 59))).toBe(0);
    });
});
