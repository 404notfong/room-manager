import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Contract } from '@modules/contracts/schemas/contract.schema';
import { Invoice } from '@modules/invoices/schemas/invoice.schema';
import { ContractStatus, ContractType, RoomType } from '@common/constants/enums';
import { PaymentDueProducer } from './payment-due.producer';
import { CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';

const ownerId = new Types.ObjectId().toString();

function makeContract(overrides: any) {
    return {
        _id: new Types.ObjectId(),
        ownerId: new Types.ObjectId(ownerId),
        status: ContractStatus.ACTIVE,
        contractType: ContractType.LONG_TERM,
        roomType: RoomType.LONG_TERM,
        startDate: new Date('2026-01-01'),
        rentPrice: 3000000,
        paymentCycleMonths: 1,
        paymentDueDay: 5,
        roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: new Types.ObjectId(), name: 'A' } },
        tenantId: { _id: new Types.ObjectId(), name: 'Khach 1' },
        ...overrides,
    };
}

describe('PaymentDueProducer', () => {
    let producer: PaymentDueProducer;
    let contractModel: any;
    let invoiceModel: any;

    beforeEach(async () => {
        contractModel = {
            find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        invoiceModel = {
            find: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                PaymentDueProducer,
                { provide: getModelToken(Contract.name), useValue: contractModel },
                { provide: getModelToken(Invoice.name), useValue: invoiceModel },
            ],
        }).compile();
        producer = moduleRef.get(PaymentDueProducer);
    });

    function setContracts(list: any[]) {
        contractModel.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }
    function setInvoices(list: any[]) {
        invoiceModel.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }

    const may = { start: new Date('2026-05-01'), end: new Date('2026-05-31T23:59:59Z') };

    it('emits PAYMENT_DUE on payDay of cycle months when no invoice exists', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([makeContract({})]);
        const events = await producer.produce(ownerId, may);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(CalendarEventType.PAYMENT_DUE);
        expect(events[0].date.getDate()).toBe(5); // payDay
        expect(events[0].date.getMonth()).toBe(4); // May
        jest.useRealTimers();
    });

    it('suppresses PAYMENT_DUE when invoice exists for (contract, month, year)', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        const contract = makeContract({});
        setContracts([contract]);
        setInvoices([{ contractId: contract._id, billingPeriod: { month: 5, year: 2026 } }]);
        const events = await producer.produce(ownerId, may);
        expect(events).toHaveLength(0);
        jest.useRealTimers();
    });

    it('emits PAYMENT_DUE_OVERDUE with DANGER for past payDay still unpaid', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-20'));
        setContracts([makeContract({})]);
        const events = await producer.produce(ownerId, may);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(CalendarEventType.PAYMENT_DUE_OVERDUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.DANGER);
        jest.useRealTimers();
    });

    it('respects multi-month cycle (cycleMonths=3 skips 2 months between dues)', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-01'));
        const contract = makeContract({
            startDate: new Date('2026-01-01'),
            paymentCycleMonths: 3,
            paymentDueDay: 1,
        });
        setContracts([contract]);
        const sixMonths = { start: new Date('2026-01-01'), end: new Date('2026-12-31T23:59:59Z') };
        const events = await producer.produce(ownerId, sixMonths);
        const dates = events.map(e => `${e.date.getFullYear()}-${e.date.getMonth() + 1}`);
        expect(dates).toEqual(['2026-4', '2026-7', '2026-10']);
        jest.useRealTimers();
    });

    it('clamps payDay to last day of month for short months', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-02-01'));
        setContracts([makeContract({
            startDate: new Date('2026-01-01'),
            paymentDueDay: 31,
        })]);
        const feb = { start: new Date('2026-02-01'), end: new Date('2026-02-28T23:59:59Z') };
        const events = await producer.produce(ownerId, feb);
        expect(events[0].date.getDate()).toBe(28);
        jest.useRealTimers();
    });

    it('clamps paymentDueDay outside [1, 31] to safe bounds', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({ paymentDueDay: 0 }),    // edge: should clamp to 1
            makeContract({ paymentDueDay: 35 }),   // edge: should clamp to 31 → then to monthEnd
            makeContract({ paymentDueDay: -3 }),   // edge: negative → clamp to 1
        ]);
        const events = await producer.produce(ownerId, may);
        expect(events).toHaveLength(3);
        // All payment dates should be valid days (1-31), not negative or rolled backward
        for (const event of events) {
            const day = event.date.getDate();
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(31);
        }
        jest.useRealTimers();
    });

    it('emits OVERDUE for past cycles and DUE for future cycles in a multi-cycle contract', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-08-01'));
        setContracts([makeContract({
            startDate: new Date('2026-01-01'),
            paymentCycleMonths: 3,
            paymentDueDay: 1,
        })]);
        const yearRange = { start: new Date('2026-01-01'), end: new Date('2026-12-31T23:59:59Z') };
        const events = await producer.produce(ownerId, yearRange);
        expect(events).toHaveLength(3);
        // First cycle ends at 2026-04-01 (overdue from Aug 1), second at 2026-07-01 (overdue), third at 2026-10-01 (future)
        expect(events[0].type).toBe(CalendarEventType.PAYMENT_DUE_OVERDUE);
        expect(events[1].type).toBe(CalendarEventType.PAYMENT_DUE_OVERDUE);
        expect(events[2].type).toBe(CalendarEventType.PAYMENT_DUE);
        jest.useRealTimers();
    });
});
