import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import {
    ContractStatus,
    ContractType,
    PaymentCycle,
    RoomStatus,
    RoomType,
    ShortTermPricingType,
    TenantStatus,
} from '@common/constants/enums';
import { Invoice } from '@modules/invoices/schemas/invoice.schema';
import { RoomsService } from '@modules/rooms/rooms.service';
import { ServicesService } from '@modules/services/services.service';
import { TenantsService } from '@modules/tenants/tenants.service';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/contract.dto';
import { Contract } from './schemas/contract.schema';

// ─── Mock Helpers ─────────────────────────────────────────────────

const mockOwnerId = new Types.ObjectId().toString();
const mockRoomId = new Types.ObjectId().toString();
const mockTenantId = new Types.ObjectId().toString();
const mockBuildingId = new Types.ObjectId().toString();

const createBaseLongTermDto = (overrides: Partial<CreateContractDto> = {}): CreateContractDto => ({
    roomId: mockRoomId,
    buildingId: mockBuildingId,
    tenantId: mockTenantId,
    contractType: ContractType.LONG_TERM,
    roomType: RoomType.LONG_TERM,
    startDate: new Date('2025-06-01'),
    rentPrice: 3000000,
    depositAmount: 3000000,
    electricityPrice: 3500,
    waterPrice: 20000,
    initialElectricIndex: 100,
    initialWaterIndex: 50,
    paymentCycle: PaymentCycle.MONTHLY,
    paymentCycleMonths: 1,
    paymentDueDay: 1,
    ...overrides,
});

const createBaseShortTermDto = (overrides: Partial<CreateContractDto> = {}): CreateContractDto => ({
    roomId: mockRoomId,
    buildingId: mockBuildingId,
    tenantId: mockTenantId,
    contractType: ContractType.SHORT_TERM,
    roomType: RoomType.SHORT_TERM,
    startDate: new Date('2025-06-01'),
    rentPrice: 0,
    depositAmount: 500000,
    shortTermPricingType: ShortTermPricingType.FIXED,
    fixedPrice: 200000,
    ...overrides,
});

const mockRoom = { _id: mockRoomId, roomName: 'Room 101', buildingId: mockBuildingId };
const mockTenant = { _id: mockTenantId, fullName: 'Nguyen Van A', status: TenantStatus.ACTIVE };
const mockTenantRenting = { ...mockTenant, status: TenantStatus.RENTING };

// ─── Mock Factories ───────────────────────────────────────────────

const createMockContractModel = () => {
    const mockSave = jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
    });

    const MockModel: any = jest.fn().mockImplementation((data) => ({
        ...data,
        _id: new Types.ObjectId(),
        save: mockSave,
    }));

    MockModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn(), populate: jest.fn() });
    MockModel.aggregate = jest.fn().mockReturnValue({ exec: jest.fn() });
    MockModel.updateOne = jest.fn().mockReturnValue({ exec: jest.fn() });
    MockModel.countDocuments = jest.fn().mockReturnValue({ exec: jest.fn() });
    MockModel.findOneAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn() });

    return MockModel;
};

const createMockRoomsService = () => ({
    findOne: jest.fn().mockResolvedValue(mockRoom),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    updateIndexes: jest.fn().mockResolvedValue(undefined),
});

const createMockTenantsService = () => ({
    findOne: jest.fn().mockResolvedValue(mockTenant),
    create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), fullName: 'New Tenant' }),
    update: jest.fn().mockResolvedValue(undefined),
});

const createMockServicesService = () => ({
    findOne: jest.fn().mockResolvedValue(null),
});

// ─── Test Suite ───────────────────────────────────────────────────

describe('ContractsService', () => {
    let service: ContractsService;
    let contractModel: any;
    let invoiceModel: any;
    let roomsService: any;
    let tenantsService: any;
    let servicesService: any;

    beforeEach(async () => {
        contractModel = createMockContractModel();
        invoiceModel = createMockContractModel();
        roomsService = createMockRoomsService();
        tenantsService = createMockTenantsService();
        servicesService = createMockServicesService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContractsService,
                { provide: getModelToken(Contract.name), useValue: contractModel },
                { provide: getModelToken(Invoice.name), useValue: invoiceModel },
                { provide: RoomsService, useValue: roomsService },
                { provide: TenantsService, useValue: tenantsService },
                { provide: ServicesService, useValue: servicesService },
            ],
        }).compile();

        service = module.get<ContractsService>(ContractsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ═══════════════════════════════════════════════════════════════
    // V: validateCreateContract — Room & Tenant Validation
    // ═══════════════════════════════════════════════════════════════

    describe('validateCreateContract — Room & Tenant', () => {
        it('V1: should throw NotFoundException when room does not exist', async () => {
            roomsService.findOne.mockResolvedValue(null);
            const dto = createBaseLongTermDto();
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(NotFoundException);
        });

        it('V2: should throw BadRequestException when neither tenantId nor newTenant is provided', async () => {
            const dto = createBaseLongTermDto({ tenantId: undefined });
            delete (dto as any).newTenant;
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('V3: should throw NotFoundException when tenant does not exist', async () => {
            tenantsService.findOne.mockResolvedValue(null);
            const dto = createBaseLongTermDto();
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(NotFoundException);
        });

        it('V4: should throw BadRequestException when tenant status is not ACTIVE (create)', async () => {
            tenantsService.findOne.mockResolvedValue(mockTenantRenting);
            const dto = createBaseLongTermDto();
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('V6: should throw BadRequestException when newTenant is missing fullName', async () => {
            const dto = createBaseLongTermDto({
                tenantId: undefined,
                newTenant: { fullName: '', phone: '0901234567', idCard: '123456789' } as any,
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('V7: should throw BadRequestException when newTenant is missing phone', async () => {
            const dto = createBaseLongTermDto({
                tenantId: undefined,
                newTenant: { fullName: 'Test', phone: '', idCard: '123456789' } as any,
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('V8: should throw BadRequestException when newTenant is missing idCard', async () => {
            const dto = createBaseLongTermDto({
                tenantId: undefined,
                newTenant: { fullName: 'Test', phone: '0901234567', idCard: '' } as any,
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // P: Pricing Validation — Long Term
    // ═══════════════════════════════════════════════════════════════

    describe('validateCreateContract — Long Term Pricing', () => {
        it('P1: should throw when rentPrice is negative', async () => {
            const dto = createBaseLongTermDto({ rentPrice: -1 });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('P2: should throw when electricityPrice is undefined', async () => {
            const dto = createBaseLongTermDto({ electricityPrice: undefined });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('P3: should throw when initialElectricIndex is negative', async () => {
            const dto = createBaseLongTermDto({ initialElectricIndex: -1 });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('P4: should throw when initialWaterIndex is negative', async () => {
            const dto = createBaseLongTermDto({ initialWaterIndex: -1 });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('P5: should throw when paymentCycle is missing for long term', async () => {
            const dto = createBaseLongTermDto({ paymentCycle: undefined });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // S: Pricing Validation — Short Term
    // ═══════════════════════════════════════════════════════════════

    describe('validateCreateContract — Short Term Pricing', () => {
        it('S1: should throw when shortTermPricingType is missing', async () => {
            const dto = createBaseShortTermDto({ shortTermPricingType: undefined });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S2: should throw when HOURLY but hourlyPricingMode is missing', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.HOURLY,
                hourlyPricingMode: undefined,
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S3: should throw when PER_HOUR but pricePerHour <= 0', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.HOURLY,
                hourlyPricingMode: 'PER_HOUR',
                pricePerHour: 0,
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S4: should throw when FIXED but fixedPrice <= 0', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.FIXED,
                fixedPrice: 0,
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S5: should throw when DAILY price table has < 2 tiers', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.DAILY,
                shortTermPrices: [{ fromValue: 1, toValue: -1, price: 100000 }],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S6: should throw when first tier fromValue != 1', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.DAILY,
                shortTermPrices: [
                    { fromValue: 0, toValue: 3, price: 100000 },
                    { fromValue: 4, toValue: -1, price: 80000 },
                ],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S7: should throw when last tier toValue != -1', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.DAILY,
                shortTermPrices: [
                    { fromValue: 1, toValue: 3, price: 100000 },
                    { fromValue: 4, toValue: 10, price: 80000 },
                ],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S8: should throw when tier price <= 0', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.DAILY,
                shortTermPrices: [
                    { fromValue: 1, toValue: 3, price: 0 },
                    { fromValue: 4, toValue: -1, price: 80000 },
                ],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S9: should throw when tier range is invalid (toValue < fromValue)', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.DAILY,
                shortTermPrices: [
                    { fromValue: 1, toValue: 3, price: 100000 },
                    { fromValue: 5, toValue: 3, price: 80000 },
                    { fromValue: 4, toValue: -1, price: 60000 },
                ],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S10: should throw when tier gap exists', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.DAILY,
                shortTermPrices: [
                    { fromValue: 1, toValue: 3, price: 100000 },
                    { fromValue: 5, toValue: -1, price: 80000 }, // gap: should be 4
                ],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('S11: should pass with valid DAILY 2-tier table', async () => {
            const dto = createBaseShortTermDto({
                shortTermPricingType: ShortTermPricingType.DAILY,
                shortTermPrices: [
                    { fromValue: 1, toValue: 3, price: 200000 },
                    { fromValue: 4, toValue: -1, price: 150000 },
                ],
            });
            const result = await service.create(mockOwnerId, dto);
            expect(result).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // M: Mandatory Fields & Date Validation
    // ═══════════════════════════════════════════════════════════════

    describe('validateCreateContract — Mandatory Fields & Dates', () => {
        it('M1: should throw when depositAmount is undefined', async () => {
            const dto = createBaseLongTermDto({ depositAmount: undefined });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('M2: should throw when depositAmount is negative', async () => {
            const dto = createBaseLongTermDto({ depositAmount: -1 });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('M3: should throw when startDate is null', async () => {
            const dto = createBaseLongTermDto({ startDate: null as any });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('M4: should throw when endDate <= startDate', async () => {
            const dto = createBaseLongTermDto({
                startDate: new Date('2025-06-01'),
                endDate: new Date('2025-05-01'),
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('M5: should throw when long-term endDate <= startDate + paymentCycle', async () => {
            const dto = createBaseLongTermDto({
                startDate: new Date('2025-06-01'),
                endDate: new Date('2025-06-15'), // Less than 1 month cycle
                paymentCycleMonths: 1,
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('M6: should pass when endDate is undefined (indefinite)', async () => {
            const dto = createBaseLongTermDto({ endDate: undefined });
            const result = await service.create(mockOwnerId, dto);
            expect(result).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // SC: Service Charge Validation
    // ═══════════════════════════════════════════════════════════════

    describe('validateCreateContract — Service Charges', () => {
        it('SC1: should throw when service name is empty', async () => {
            const dto = createBaseLongTermDto({
                serviceCharges: [{ name: '', amount: 100000 }],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('SC2: should throw when service amount is negative', async () => {
            const dto = createBaseLongTermDto({
                serviceCharges: [{ name: 'Internet', amount: -1 }],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('SC3: should throw when serviceId does not exist', async () => {
            servicesService.findOne.mockResolvedValue(null);
            const dto = createBaseLongTermDto({
                serviceCharges: [{ name: 'Wifi', amount: 100000, serviceId: new Types.ObjectId().toString() }],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(NotFoundException);
        });

        it('SC4: should throw when service name mismatches system service', async () => {
            servicesService.findOne.mockResolvedValue({ name: 'Internet', priceType: 'FIXED', fixedPrice: 100000 });
            const dto = createBaseLongTermDto({
                serviceCharges: [{ name: 'Wifi', amount: 100000, serviceId: new Types.ObjectId().toString() }],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('SC5: should throw when FIXED service price mismatches', async () => {
            servicesService.findOne.mockResolvedValue({ name: 'Internet', priceType: 'FIXED', fixedPrice: 100000 });
            const dto = createBaseLongTermDto({
                serviceCharges: [{ name: 'Internet', amount: 150000, serviceId: new Types.ObjectId().toString() }],
            });
            await expect(service.create(mockOwnerId, dto)).rejects.toThrow(BadRequestException);
        });

        it('SC6: should pass when system service matches and only quantity differs', async () => {
            servicesService.findOne.mockResolvedValue({ name: 'Internet', priceType: 'FIXED', fixedPrice: 100000 });
            const dto = createBaseLongTermDto({
                serviceCharges: [{
                    name: 'Internet',
                    amount: 100000,
                    quantity: 2,
                    serviceId: new Types.ObjectId().toString(),
                }],
            });
            const result = await service.create(mockOwnerId, dto);
            expect(result).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // C: Create Logic
    // ═══════════════════════════════════════════════════════════════

    describe('create — Happy Path & Side Effects', () => {
        it('C1: should create contract with existing tenantId and set Room=OCCUPIED, Tenant=RENTING', async () => {
            const dto = createBaseLongTermDto();
            const result = await service.create(mockOwnerId, dto);

            expect(result).toBeDefined();
            expect(result.contractCode).toMatch(/^HD-/);
            expect(roomsService.updateStatus).toHaveBeenCalledWith(mockRoomId, mockOwnerId, RoomStatus.OCCUPIED);
            expect(tenantsService.update).toHaveBeenCalledWith(
                mockTenantId,
                mockOwnerId,
                expect.objectContaining({ status: TenantStatus.RENTING }),
                true,
            );
        });

        it('C2: should create new tenant first when newTenant is provided', async () => {
            const newTenantId = new Types.ObjectId();
            tenantsService.create.mockResolvedValue({ _id: newTenantId, fullName: 'New Tenant' });

            const dto = createBaseLongTermDto({
                tenantId: undefined,
                newTenant: { fullName: 'New Tenant', phone: '0901234567', idCard: '123456789' },
            });
            const result = await service.create(mockOwnerId, dto);

            expect(tenantsService.create).toHaveBeenCalledWith(mockOwnerId, dto.newTenant);
            expect(result).toBeDefined();
        });

        it('C3: should set Room=DEPOSITED and Tenant=DEPOSITED for DRAFT contracts', async () => {
            const dto = createBaseLongTermDto({ status: ContractStatus.DRAFT });
            const result = await service.create(mockOwnerId, dto);

            expect(result).toBeDefined();
            expect(roomsService.updateStatus).toHaveBeenCalledWith(mockRoomId, mockOwnerId, RoomStatus.DEPOSITED);
            expect(tenantsService.update).toHaveBeenCalledWith(
                mockTenantId,
                mockOwnerId,
                expect.objectContaining({ status: TenantStatus.DEPOSITED }),
                true,
            );
        });

        it('C4: should auto-generate contractCode with HD- prefix', async () => {
            const dto = createBaseLongTermDto();
            const result = await service.create(mockOwnerId, dto);
            expect(result.contractCode).toMatch(/^HD-[A-Z0-9]+-\d{4}$/);
        });

        it('C5: should calculate nextPaymentDate for long-term contracts', async () => {
            const dto = createBaseLongTermDto({
                startDate: new Date('2025-01-15'),
                paymentCycleMonths: 1,
                paymentDueDay: 15,
            });
            const result = await service.create(mockOwnerId, dto);
            expect(result.nextPaymentDate).toBeDefined();
            // Should be Feb 15, 2025
            const expected = new Date('2025-02-15');
            expect(result.nextPaymentDate.getMonth()).toBe(expected.getMonth());
            expect(result.nextPaymentDate.getDate()).toBe(expected.getDate());
        });

        it('C6: should NOT set nextPaymentDate for short-term contracts', async () => {
            const dto = createBaseShortTermDto();
            const result = await service.create(mockOwnerId, dto);
            expect(result.nextPaymentDate).toBeUndefined();
        });

        it('C7: should sync meter readings to room for long-term contracts', async () => {
            const dto = createBaseLongTermDto({
                initialElectricIndex: 150,
                initialWaterIndex: 75,
            });
            await service.create(mockOwnerId, dto);

            expect(roomsService.updateIndexes).toHaveBeenCalledWith(mockRoomId, mockOwnerId, {
                currentElectricIndex: 150,
                currentWaterIndex: 75,
            });
        });

        it('C8: should NOT sync meter readings for short-term contracts', async () => {
            const dto = createBaseShortTermDto();
            await service.create(mockOwnerId, dto);
            expect(roomsService.updateIndexes).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // H: Helper Methods
    // ═══════════════════════════════════════════════════════════════

    describe('Helper Methods', () => {
        it('H1: generateContractCode should match pattern HD-{base36}-{4digits}', async () => {
            // We test indirectly through create
            const dto = createBaseLongTermDto();
            const result = await service.create(mockOwnerId, dto);
            expect(result.contractCode).toMatch(/^HD-[A-Z0-9]+-\d{4}$/);
        });

        it('H2: calculateNextPaymentDate — normal month', async () => {
            const dto = createBaseLongTermDto({
                startDate: new Date('2025-03-10'),
                paymentCycleMonths: 1,
                paymentDueDay: 10,
            });
            const result = await service.create(mockOwnerId, dto);
            expect(result.nextPaymentDate.getMonth()).toBe(3); // April = 3
            expect(result.nextPaymentDate.getDate()).toBe(10);
        });

        it('H3: calculateNextPaymentDate — overflow (e.g. due=31 in Feb)', async () => {
            const dto = createBaseLongTermDto({
                startDate: new Date('2025-01-31'),
                paymentCycleMonths: 1,
                paymentDueDay: 31,
            });
            const result = await service.create(mockOwnerId, dto);
            // Feb 2025 has 28 days
            expect(result.nextPaymentDate.getMonth()).toBe(1); // Feb = 1
            expect(result.nextPaymentDate.getDate()).toBe(28);
        });
    });
});
