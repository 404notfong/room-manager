import { Injectable } from '@nestjs/common';
import {
    CalendarDayEventsDto,
    CalendarEventDto,
    CalendarEventSeverity,
    CalendarEventType,
    CalendarMonthSummaryDto,
} from './dto/calendar-event.dto';
import { ContractEventsProducer } from './producers/contract-events.producer';
import { InvoiceEventsProducer } from './producers/invoice-events.producer';
import { PaymentDueProducer } from './producers/payment-due.producer';
import { toLocalDateKey } from './helpers/date-keys';

const ALL_EVENT_TYPES: CalendarEventType[] = [
    CalendarEventType.DEPOSIT_CHECKIN_DUE,
    CalendarEventType.DEPOSIT_CHECKIN_OVERDUE,
    CalendarEventType.ACTIVE_CHECKOUT_DUE,
    CalendarEventType.ACTIVE_CHECKOUT_OVERDUE,
    CalendarEventType.INVOICE_DUE,
    CalendarEventType.INVOICE_OVERDUE,
    CalendarEventType.PAYMENT_DUE,
    CalendarEventType.PAYMENT_DUE_OVERDUE,
];

@Injectable()
export class CalendarService {
    constructor(
        private readonly contractProducer: ContractEventsProducer,
        private readonly invoiceProducer: InvoiceEventsProducer,
        private readonly paymentProducer: PaymentDueProducer,
    ) {}

    async getEventsInRange(
        ownerId: string,
        start: Date,
        end: Date,
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const range = { start, end };
        const [contractEvents, invoiceEvents, paymentEvents] = await Promise.all([
            this.contractProducer.produce(ownerId, range, buildingId),
            this.invoiceProducer.produce(ownerId, range, buildingId),
            this.paymentProducer.produce(ownerId, range, buildingId),
        ]);

        const events = [...contractEvents, ...invoiceEvents, ...paymentEvents];
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return events;
    }

    async getEventsByDay(
        ownerId: string,
        date: Date,
        buildingId?: string,
    ): Promise<CalendarDayEventsDto> {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        const events = await this.getEventsInRange(ownerId, start, end, buildingId);
        return { date: toLocalDateKey(date), events };
    }

    async getMonthSummary(
        ownerId: string,
        year: number,
        month: number,
        buildingId?: string,
    ): Promise<CalendarMonthSummaryDto> {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        const events = await this.getEventsInRange(ownerId, start, end, buildingId);

        const days: Record<string, Record<CalendarEventType, number>> = {};
        for (const event of events) {
            const key = toLocalDateKey(new Date(event.date));
            if (!days[key]) {
                days[key] = ALL_EVENT_TYPES.reduce(
                    (acc, t) => ({ ...acc, [t]: 0 }),
                    {} as Record<CalendarEventType, number>,
                );
            }
            days[key][event.type]++;
        }
        return { days, totalEvents: events.length };
    }

    async getOverdue(ownerId: string, buildingId?: string): Promise<CalendarEventDto[]> {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const wideRange = { start: new Date(0), end: today };

        const [contractEvents, invoiceEvents, paymentEvents] = await Promise.all([
            this.contractProducer.produce(ownerId, wideRange, buildingId),
            this.invoiceProducer.produce(ownerId, wideRange, buildingId),
            this.paymentProducer.produce(ownerId, wideRange, buildingId),
        ]);

        const all = [...contractEvents, ...invoiceEvents, ...paymentEvents]
            .filter((e) => e.severity === CalendarEventSeverity.DANGER);
        all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return all;
    }
}
