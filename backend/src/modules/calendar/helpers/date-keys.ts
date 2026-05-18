/** Convert a Date to 'YYYY-MM-DD' in local timezone. */
export function toLocalDateKey(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Returns a new Date at the start of the local day (00:00:00.000). */
export function startOfLocalDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Returns integer day delta (to - from), using local-day boundaries. */
export function daysBetween(from: Date, to: Date): number {
    const fromDay = startOfLocalDay(from).getTime();
    const toDay = startOfLocalDay(to).getTime();
    return Math.round((toDay - fromDay) / (1000 * 60 * 60 * 24));
}
