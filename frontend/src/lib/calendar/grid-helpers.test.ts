import { describe, it, expect } from 'vitest';
import { buildMonthGrid } from './grid-helpers';

describe('buildMonthGrid', () => {
    it('returns 35 cells for a month that fits in 5 weeks', () => {
        // May 2026: starts Friday, has 31 days → needs 5 weeks (35 cells) or 6 (42 cells) depending on layout
        // Friday-Monday=4 leading days, 31 days → 35 cells total. But 4+31=35, exactly 5 weeks.
        const grid = buildMonthGrid(new Date(2026, 4, 1)); // May 2026
        expect(grid.length).toBe(35);
    });

    it('returns 42 cells when needed', () => {
        // Aug 2026 — Saturday start → 5 leading + 31 days = 36, ceil to 42
        const grid = buildMonthGrid(new Date(2026, 7, 1));
        expect(grid.length).toBe(42);
    });

    it('marks leading days as not in current month', () => {
        const grid = buildMonthGrid(new Date(2026, 4, 1)); // May 1 = Friday → 4 leading days from April
        expect(grid[0].isCurrentMonth).toBe(false);
        expect(grid[3].isCurrentMonth).toBe(false);
        expect(grid[4].isCurrentMonth).toBe(true); // first day of May
        expect(grid[4].date.getDate()).toBe(1);
    });

    it('starts on Monday', () => {
        const grid = buildMonthGrid(new Date(2026, 4, 1));
        // grid[0] should be a Monday — getDay() returns 1 for Monday
        expect(grid[0].date.getDay()).toBe(1);
    });

    it('returns at least 35 cells even for a Monday-start 28-day February', () => {
        // Feb 2027 starts on Monday, has 28 days → without the floor, would be 28 cells
        const grid = buildMonthGrid(new Date(2027, 1, 1));
        expect(grid.length).toBe(35);
    });
});
