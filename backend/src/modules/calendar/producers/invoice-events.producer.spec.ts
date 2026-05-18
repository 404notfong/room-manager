import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Invoice } from '@modules/invoices/schemas/invoice.schema';
import { InvoiceEventsProducer } from './invoice-events.producer';
import { CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';

const ownerId = new Types.ObjectId().toString();

function makeInvoice(overrides: any) {
    return {
        _id: new Types.ObjectId(),
        dueDate: new Date('2026-05-10'),
        remainingAmount: 1500000,
        status: 'PENDING',
        roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: new Types.ObjectId(), name: 'Toa A' } },
        tenantId: { _id: new Types.ObjectId(), name: 'Khach 1' },
        ...overrides,
    };
}

describe('InvoiceEventsProducer', () => {
    let producer: InvoiceEventsProducer;
    let invoiceModel: any;

    beforeEach(async () => {
        invoiceModel = {
            find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                InvoiceEventsProducer,
                { provide: getModelToken(Invoice.name), useValue: invoiceModel },
            ],
        }).compile();
        producer = moduleRef.get(InvoiceEventsProducer);
    });

    function setInvoices(list: any[]) {
        invoiceModel.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }

    const range = { start: new Date('2026-05-01'), end: new Date('2026-05-31T23:59:59Z') };

    it('emits INVOICE_DUE for future dueDate in range', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-05'));
        setInvoices([makeInvoice({ dueDate: new Date('2026-05-20') })]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.INVOICE_DUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.INFO);
        expect(events[0].amount).toBe(1500000);
        expect(events[0].roomName).toBe('P101');
        jest.useRealTimers();
    });

    it('emits INVOICE_OVERDUE with daysOverdue for past dueDate', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-20'));
        setInvoices([makeInvoice({ dueDate: new Date('2026-05-10') })]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.INVOICE_OVERDUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.DANGER);
        expect(events[0].daysOverdue).toBe(10);
        jest.useRealTimers();
    });

    it('filters by buildingId', async () => {
        const target = new Types.ObjectId();
        const other = new Types.ObjectId();
        setInvoices([
            makeInvoice({ roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: target, name: 'A' } } }),
            makeInvoice({ roomId: { _id: new Types.ObjectId(), roomName: 'P201', buildingId: { _id: other, name: 'B' } } }),
        ]);
        const events = await producer.produce(ownerId, range, target.toString());
        expect(events).toHaveLength(1);
        expect(events[0].roomName).toBe('P101');
    });

    it('filters out invoices with remainingAmount <= 0', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-05'));
        setInvoices([
            makeInvoice({ remainingAmount: 0 }),
            makeInvoice({ remainingAmount: -500 }), // edge: negative
        ]);
        const events = await producer.produce(ownerId, range);
        expect(events).toHaveLength(0);
        jest.useRealTimers();
    });
});
