import { describe, it, expect } from 'vitest';
import { composeEventBarLabel, composeEventTitle, composeEventDescription, getRelatedPath } from './event-display';
import type { CalendarEvent } from '@/api/calendar';

const t = (key: string) => {
    const map: Record<string, string> = {
        'calendar.shortLabels.INVOICE_OVERDUE': 'Hóa đơn quá hạn',
        'calendar.shortLabels.DEPOSIT_CHECKIN_DUE': 'Check-in',
        'calendar.eventTypes.INVOICE_OVERDUE': 'Hóa đơn quá hạn',
    };
    return map[key] ?? key;
};

const baseEvent: CalendarEvent = {
    _id: 'e1',
    date: '2026-05-15T00:00:00Z',
    type: 'INVOICE_OVERDUE',
    severity: 'danger',
    relatedId: 'inv1',
    relatedType: 'invoice',
    roomName: 'P301',
    tenantName: 'Khach 1',
    amount: 1500000,
};

describe('event-display', () => {
    it('composes bar label with roomName', () => {
        expect(composeEventBarLabel(baseEvent, t)).toBe('P301 · Hóa đơn quá hạn');
    });

    it('omits roomName when N/A or absent', () => {
        expect(composeEventBarLabel({ ...baseEvent, roomName: 'N/A' }, t)).toBe('Hóa đơn quá hạn');
        expect(composeEventBarLabel({ ...baseEvent, roomName: undefined }, t)).toBe('Hóa đơn quá hạn');
    });

    it('composes title with room', () => {
        expect(composeEventTitle(baseEvent, t)).toBe('Hóa đơn quá hạn - P301');
    });

    it('composes description with tenant + amount (vi-VN locale)', () => {
        expect(composeEventDescription(baseEvent, 'vi')).toBe('Khach 1 · 1.500.000 VND');
    });

    it('skips N/A tenant in description', () => {
        expect(composeEventDescription({ ...baseEvent, tenantName: 'N/A' }, 'vi')).toBe('1.500.000 VND');
    });

    it('returns contract path for relatedType=contract', () => {
        expect(getRelatedPath({ ...baseEvent, relatedType: 'contract', relatedId: 'c1' })).toBe('/contracts/c1');
    });

    it('returns invoice path for relatedType=invoice', () => {
        expect(getRelatedPath(baseEvent)).toBe('/invoices/inv1');
    });
});
