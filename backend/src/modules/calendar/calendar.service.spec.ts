import { Test } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { ContractEventsProducer } from './producers/contract-events.producer';
import { InvoiceEventsProducer } from './producers/invoice-events.producer';
import { PaymentDueProducer } from './producers/payment-due.producer';
import { CalendarEventType, CalendarEventSeverity } from './dto/calendar-event.dto';

describe('CalendarService', () => {
    let service: CalendarService;
    let contractProducer: jest.Mocked<ContractEventsProducer>;
    let invoiceProducer: jest.Mocked<InvoiceEventsProducer>;
    let paymentProducer: jest.Mocked<PaymentDueProducer>;

    beforeEach(async () => {
        contractProducer = { produce: jest.fn().mockResolvedValue([]) } as any;
        invoiceProducer = { produce: jest.fn().mockResolvedValue([]) } as any;
        paymentProducer = { produce: jest.fn().mockResolvedValue([]) } as any;

        const moduleRef = await Test.createTestingModule({
            providers: [
                CalendarService,
                { provide: ContractEventsProducer, useValue: contractProducer },
                { provide: InvoiceEventsProducer, useValue: invoiceProducer },
                { provide: PaymentDueProducer, useValue: paymentProducer },
            ],
        }).compile();
        service = moduleRef.get(CalendarService);
    });

    it('aggregates events from all three producers sorted by date asc', async () => {
        contractProducer.produce.mockResolvedValue([
            { _id: 'c1', date: new Date('2026-05-20'), type: CalendarEventType.DEPOSIT_CHECKIN_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);
        invoiceProducer.produce.mockResolvedValue([
            { _id: 'i1', date: new Date('2026-05-10'), type: CalendarEventType.INVOICE_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);
        paymentProducer.produce.mockResolvedValue([
            { _id: 'p1', date: new Date('2026-05-15'), type: CalendarEventType.PAYMENT_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);

        const events = await service.getEventsInRange('o1', new Date('2026-05-01'), new Date('2026-05-31'));
        expect(events.map(e => e._id)).toEqual(['i1', 'p1', 'c1']);
    });

    it('getOverdue returns only DANGER events sorted by date desc', async () => {
        contractProducer.produce.mockResolvedValue([
            { _id: 'a', date: new Date('2026-03-01'), severity: CalendarEventSeverity.DANGER } as any,
            { _id: 'b', date: new Date('2026-04-01'), severity: CalendarEventSeverity.INFO } as any,
        ]);
        invoiceProducer.produce.mockResolvedValue([
            { _id: 'c', date: new Date('2026-01-01'), severity: CalendarEventSeverity.DANGER } as any,
        ]);
        paymentProducer.produce.mockResolvedValue([]);

        const events = await service.getOverdue('o1');
        expect(events.map(e => e._id)).toEqual(['a', 'c']);
    });

    it('getMonthSummary returns day-keyed counts per type', async () => {
        invoiceProducer.produce.mockResolvedValue([
            { _id: 'i1', date: new Date(2026, 4, 15), type: CalendarEventType.INVOICE_DUE, severity: CalendarEventSeverity.INFO } as any,
            { _id: 'i2', date: new Date(2026, 4, 15), type: CalendarEventType.INVOICE_DUE, severity: CalendarEventSeverity.INFO } as any,
        ]);

        const summary = await service.getMonthSummary('o1', 2026, 5);
        expect(summary.totalEvents).toBe(2);
        expect(summary.days['2026-05-15'][CalendarEventType.INVOICE_DUE]).toBe(2);
    });
});
