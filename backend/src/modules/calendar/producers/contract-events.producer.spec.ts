import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Contract } from '@modules/contracts/schemas/contract.schema';
import { ContractStatus, ContractType, RoomType } from '@common/constants/enums';
import { ContractEventsProducer } from './contract-events.producer';
import { CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';

const ownerId = new Types.ObjectId().toString();

function makeContract(overrides: any) {
    return {
        _id: new Types.ObjectId(),
        ownerId: new Types.ObjectId(ownerId),
        status: ContractStatus.ACTIVE,
        contractType: ContractType.LONG_TERM,
        roomType: RoomType.LONG_TERM,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2027-05-01'),
        roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: new Types.ObjectId(), name: 'Toa A' } },
        tenantId: { _id: new Types.ObjectId(), name: 'Khach 1' },
        ...overrides,
    };
}

describe('ContractEventsProducer', () => {
    let producer: ContractEventsProducer;
    let contractModel: any;

    beforeEach(async () => {
        contractModel = {
            find: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([]),
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                ContractEventsProducer,
                { provide: getModelToken(Contract.name), useValue: contractModel },
            ],
        }).compile();
        producer = moduleRef.get(ContractEventsProducer);
    });

    function setContracts(list: any[]) {
        contractModel.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(list),
        });
    }

    const range = { start: new Date('2026-05-01'), end: new Date('2026-05-31T23:59:59Z') };

    it('emits DEPOSIT_CHECKIN_DUE with info severity for DRAFT contract >7d away', async () => {
        const today = new Date('2026-05-01');
        jest.useFakeTimers().setSystemTime(today);

        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-20') }), // 19 days away
        ]);

        const events = await producer.produce(ownerId, range);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(CalendarEventType.DEPOSIT_CHECKIN_DUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.INFO);
        expect(events[0].roomName).toBe('P101');
        expect(events[0].title).toBeUndefined();
        expect(events[0].description).toBeUndefined();

        jest.useRealTimers();
    });

    it('emits DEPOSIT_CHECKIN_DUE with warning severity for DRAFT contract within 7d', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-05') }), // 4 days
        ]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].severity).toBe(CalendarEventSeverity.WARNING);
        jest.useRealTimers();
    });

    it('emits DEPOSIT_CHECKIN_OVERDUE with danger for past DRAFT in range', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-20'));
        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-10') }), // 10 days overdue
        ]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.DEPOSIT_CHECKIN_OVERDUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.DANGER);
        expect(events[0].daysOverdue).toBe(10);
        jest.useRealTimers();
    });

    it('does NOT emit CONTRACT_START or CONTRACT_END', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({ status: ContractStatus.DRAFT, startDate: new Date('2026-05-25') }),
            makeContract({ status: ContractStatus.ACTIVE, endDate: new Date('2026-05-30') }),
        ]);
        const events = await producer.produce(ownerId, range);
        const types = events.map(e => e.type);
        expect(types).not.toContain('CONTRACT_START');
        expect(types).not.toContain('CONTRACT_END');
        jest.useRealTimers();
    });

    it('emits ACTIVE_CHECKOUT_DUE with severity by proximity', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({ status: ContractStatus.ACTIVE, endDate: new Date('2026-05-25') }), // 24 days → info
        ]);
        const events = await producer.produce(ownerId, range);
        expect(events[0].type).toBe(CalendarEventType.ACTIVE_CHECKOUT_DUE);
        expect(events[0].severity).toBe(CalendarEventSeverity.INFO);
        jest.useRealTimers();
    });

    it('filters by buildingId when provided', async () => {
        const matchingBuildingId = new Types.ObjectId();
        const otherBuildingId = new Types.ObjectId();
        jest.useFakeTimers().setSystemTime(new Date('2026-05-01'));
        setContracts([
            makeContract({
                status: ContractStatus.DRAFT,
                startDate: new Date('2026-05-10'),
                roomId: { _id: new Types.ObjectId(), roomName: 'P101', buildingId: { _id: matchingBuildingId, name: 'A' } },
            }),
            makeContract({
                status: ContractStatus.DRAFT,
                startDate: new Date('2026-05-10'),
                roomId: { _id: new Types.ObjectId(), roomName: 'P201', buildingId: { _id: otherBuildingId, name: 'B' } },
            }),
        ]);

        const events = await producer.produce(ownerId, range, matchingBuildingId.toString());
        expect(events).toHaveLength(1);
        expect(events[0].roomName).toBe('P101');
        jest.useRealTimers();
    });
});
