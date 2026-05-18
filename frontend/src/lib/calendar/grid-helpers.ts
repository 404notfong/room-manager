import { addDays, endOfMonth, getDay, startOfMonth } from 'date-fns';

export interface MonthGridCell {
    date: Date;
    isCurrentMonth: boolean;
}

/**
 * Build a 35 or 42-cell grid (5 or 6 full weeks starting Monday).
 * - Leading days from previous month fill the first row up to the month's first day
 * - Trailing days from next month fill the last row
 * - The grid is always 5 or 6 full weeks (never fewer than the days needed)
 */
export function buildMonthGrid(date: Date): MonthGridCell[] {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    // Monday=0, Tuesday=1, ..., Sunday=6 (getDay returns 0=Sun, so transform)
    const leadingDays = (getDay(monthStart) + 6) % 7;
    const totalDaysInMonth = monthEnd.getDate();

    const totalCells = Math.ceil((leadingDays + totalDaysInMonth) / 7) * 7;
    const cells: MonthGridCell[] = [];

    const firstCellDate = addDays(monthStart, -leadingDays);
    for (let i = 0; i < totalCells; i++) {
        const d = addDays(firstCellDate, i);
        cells.push({
            date: d,
            isCurrentMonth: d.getMonth() === monthStart.getMonth() && d.getFullYear() === monthStart.getFullYear(),
        });
    }
    return cells;
}
