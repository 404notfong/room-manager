import type { CalendarEvent } from '@/api/calendar';

type Translator = (key: string, opts?: Record<string, unknown>) => string;

/** Build the room-cell short label: "{roomName} · {shortLabel}" */
export function composeEventBarLabel(event: CalendarEvent, t: Translator): string {
    const shortLabel = t(`calendar.shortLabels.${event.type}`);
    if (event.roomName && event.roomName !== 'N/A') {
        return `${event.roomName} · ${shortLabel}`;
    }
    return shortLabel;
}

/** Build the modal title: "{eventTypeLabel} - {roomName}" */
export function composeEventTitle(event: CalendarEvent, t: Translator): string {
    const typeLabel = t(`calendar.eventTypes.${event.type}`);
    if (event.roomName && event.roomName !== 'N/A') {
        return `${typeLabel} - ${event.roomName}`;
    }
    return typeLabel;
}

/** Build the modal one-line description: tenant + amount (skips N/A) */
export function composeEventDescription(event: CalendarEvent, locale: string): string {
    const parts: string[] = [];
    if (event.tenantName && event.tenantName !== 'N/A') parts.push(event.tenantName);
    if (event.amount && event.amount > 0) {
        parts.push(`${event.amount.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} VND`);
    }
    return parts.join(' · ');
}

/** Returns the route to navigate to when CTA clicked. */
export function getRelatedPath(event: CalendarEvent): string {
    return event.relatedType === 'contract'
        ? `/contracts/${event.relatedId}`
        : `/invoices/${event.relatedId}`;
}
