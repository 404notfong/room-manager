import apiClient from './client';

export type CalendarEventType =
    | 'DEPOSIT_CHECKIN_DUE'
    | 'DEPOSIT_CHECKIN_OVERDUE'
    | 'ACTIVE_CHECKOUT_DUE'
    | 'ACTIVE_CHECKOUT_OVERDUE'
    | 'INVOICE_DUE'
    | 'INVOICE_OVERDUE'
    | 'PAYMENT_DUE'
    | 'PAYMENT_DUE_OVERDUE';

export type CalendarEventSeverity = 'info' | 'warning' | 'danger';

export interface CalendarEvent {
    _id: string;
    date: string;
    type: CalendarEventType;
    severity: CalendarEventSeverity;
    relatedId: string;
    relatedType: 'contract' | 'invoice';
    roomName?: string;
    tenantName?: string;
    buildingName?: string;
    amount?: number;
    daysOverdue?: number;
    title?: string;
    description?: string;
}

export interface CalendarDayEvents {
    date: string;
    events: CalendarEvent[];
}

export interface CalendarMonthSummary {
    days: Record<string, Partial<Record<CalendarEventType, number>>>;
    totalEvents: number;
}

export const calendarApi = {
    getEvents: async (start: string, end: string, buildingId?: string): Promise<CalendarEvent[]> => {
        const params = new URLSearchParams({ start, end });
        if (buildingId) params.append('buildingId', buildingId);
        const response = await apiClient.get(`/calendar/events?${params}`);
        return response.data;
    },

    getDayEvents: async (date: string, buildingId?: string): Promise<CalendarDayEvents> => {
        const params = new URLSearchParams({ date });
        if (buildingId) params.append('buildingId', buildingId);
        const response = await apiClient.get(`/calendar/day?${params}`);
        return response.data;
    },

    getMonthSummary: async (year: number, month: number, buildingId?: string): Promise<CalendarMonthSummary> => {
        const params = new URLSearchParams({ year: year.toString(), month: month.toString() });
        if (buildingId) params.append('buildingId', buildingId);
        const response = await apiClient.get(`/calendar/month-summary?${params}`);
        return response.data;
    },

    getOverdue: async (buildingId?: string): Promise<CalendarEvent[]> => {
        const params = new URLSearchParams();
        if (buildingId) params.append('buildingId', buildingId);
        const qs = params.toString();
        const response = await apiClient.get(`/calendar/overdue${qs ? `?${qs}` : ''}`);
        return response.data;
    },
};
