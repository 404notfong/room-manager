import type { CalendarEventType, CalendarEventSeverity } from '@/api/calendar';

export interface EventColorSet {
    shell: string;      // chip background + text
    dot: string;        // small color dot
    bar: string;        // stacked bar background + text + border-left
}

export const EVENT_COLORS: Record<CalendarEventType, EventColorSet> = {
    DEPOSIT_CHECKIN_DUE:    { shell: 'bg-info/12 text-info',    dot: 'bg-info',    bar: 'bg-info/12 text-info border-l-[3px] border-info' },
    DEPOSIT_CHECKIN_OVERDUE:{ shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
    ACTIVE_CHECKOUT_DUE:    { shell: 'bg-warning/12 text-warning', dot: 'bg-warning', bar: 'bg-warning/12 text-warning border-l-[3px] border-warning' },
    ACTIVE_CHECKOUT_OVERDUE:{ shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
    INVOICE_DUE:            { shell: 'bg-warning/12 text-warning', dot: 'bg-warning', bar: 'bg-warning/12 text-warning border-l-[3px] border-warning' },
    INVOICE_OVERDUE:        { shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
    PAYMENT_DUE:            { shell: 'bg-success/12 text-success', dot: 'bg-success', bar: 'bg-success/12 text-success border-l-[3px] border-success' },
    PAYMENT_DUE_OVERDUE:    { shell: 'bg-error/12 text-error',  dot: 'bg-error',   bar: 'bg-error/12 text-error border-l-[3px] border-error' },
};

export function getSeverityClasses(severity: CalendarEventSeverity): string {
    switch (severity) {
        case 'danger':  return 'border-error text-error';
        case 'warning': return 'border-warning text-warning';
        default:        return 'border-info text-info';
    }
}
