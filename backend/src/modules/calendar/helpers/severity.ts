import { CalendarEventSeverity } from '../dto/calendar-event.dto';

export function computeSeverity(daysUntil: number): CalendarEventSeverity {
    if (daysUntil < 0) return CalendarEventSeverity.DANGER;
    if (daysUntil <= 7) return CalendarEventSeverity.WARNING;
    return CalendarEventSeverity.INFO;
}
