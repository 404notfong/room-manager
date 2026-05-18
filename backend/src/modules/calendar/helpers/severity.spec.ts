import { computeSeverity } from './severity';
import { CalendarEventSeverity } from '../dto/calendar-event.dto';

describe('computeSeverity', () => {
    it('returns danger when overdue', () => {
        expect(computeSeverity(-1)).toBe(CalendarEventSeverity.DANGER);
        expect(computeSeverity(-30)).toBe(CalendarEventSeverity.DANGER);
    });
    it('returns warning when within 7 days', () => {
        expect(computeSeverity(0)).toBe(CalendarEventSeverity.WARNING);
        expect(computeSeverity(3)).toBe(CalendarEventSeverity.WARNING);
        expect(computeSeverity(7)).toBe(CalendarEventSeverity.WARNING);
    });
    it('returns info when more than 7 days away', () => {
        expect(computeSeverity(8)).toBe(CalendarEventSeverity.INFO);
        expect(computeSeverity(30)).toBe(CalendarEventSeverity.INFO);
    });
});
