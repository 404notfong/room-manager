import { TenantStatus } from '@common/constants/enums';
import { escapeRegExp, normalizeString } from '@common/utils/string.util';
import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { Payment, PaymentDocument } from '@modules/payments/schemas/payment.schema';
import { ContractHistoryData, GetTenantHistoryDto, HistoryEventType, InvoiceHistoryData, PaymentHistoryData, TenantHistoryEvent } from '@modules/tenants/dto/tenant-history.dto';
import { CreateTenantDto, GetTenantsDto, UpdateTenantDto } from '@modules/tenants/dto/tenant.dto';
import { Tenant, TenantDocument } from '@modules/tenants/schemas/tenant.schema';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class TenantsService {
    constructor(
        @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    ) { }

    /**
     * Generate unique tenant code
     * Format: T-{timestamp}-{random}
     */
    private generateCode(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `T-${timestamp}-${random}`;
    }

    async create(ownerId: string, createTenantDto: CreateTenantDto): Promise<Tenant> {
        if (createTenantDto.status === TenantStatus.RENTING) {
            throw new ForbiddenException('Cannot manually set status to RENTING');
        }

        // Check for duplicate phone
        const existingPhone = await this.tenantModel.findOne({
            ownerId: new Types.ObjectId(ownerId),
            phone: createTenantDto.phone,
            isDeleted: false
        }).exec();
        if (existingPhone) {
            throw new ConflictException('PHONE_EXISTS');
        }

        // Check for duplicate idCard
        const existingIdCard = await this.tenantModel.findOne({
            ownerId: new Types.ObjectId(ownerId),
            idCard: createTenantDto.idCard,
            isDeleted: false
        }).exec();
        if (existingIdCard) {
            throw new ConflictException('ID_CARD_EXISTS');
        }

        let code = this.generateCode();

        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 5) {
            const existing = await this.tenantModel.findOne({ code, ownerId: new Types.ObjectId(ownerId) }).exec();
            if (!existing) break;
            code = this.generateCode() + Math.floor(Math.random() * 10);
            attempts++;
        }

        const tenant = new this.tenantModel({
            ...createTenantDto,
            fullNameNormalized: normalizeString(createTenantDto.fullName),
            code,
            ownerId: new Types.ObjectId(ownerId)
        });
        return tenant.save();
    }

    async findAll(ownerId: string, query?: GetTenantsDto): Promise<any> {
        const filter: any = { ownerId: new Types.ObjectId(ownerId), isDeleted: false };
        const { search, status, currentRoomId, page = 1, limit = 10 } = query || {};

        if (status) {
            filter.status = status;
        }

        if (currentRoomId) {
            filter.currentRoomId = new Types.ObjectId(currentRoomId);
        }

        if (search) {
            const escapedSearch = escapeRegExp(search);
            const normalizedSearch = normalizeString(search);
            const escapedNormalizedSearch = escapeRegExp(normalizedSearch);
            if (escapedNormalizedSearch) {
                const searchRegex = new RegExp(escapedNormalizedSearch, 'i');
                const rawSearchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { fullNameNormalized: searchRegex },
                    { code: rawSearchRegex },
                    { fullName: rawSearchRegex },
                    { phone: rawSearchRegex },
                    { idCard: rawSearchRegex }
                ];
            } else {
                // If special chars only or empty normalization, use regex on main fields
                const searchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { fullName: searchRegex },
                    { code: searchRegex },
                    { phone: searchRegex },
                    { idCard: searchRegex }
                ];
            }
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.tenantModel.find(filter)
                .populate('currentRoomId', 'roomName roomCode')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.tenantModel.countDocuments(filter).exec()
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findOne(id: string, ownerId: string): Promise<Tenant> {
        const tenant = await this.tenantModel.findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false }).exec();
        if (!tenant) throw new NotFoundException('Tenant not found');
        return tenant;
    }

    async update(id: string, ownerId: string, updateTenantDto: Partial<UpdateTenantDto>, isInternal = false): Promise<Tenant> {
        if (!isInternal && updateTenantDto.status === TenantStatus.RENTING) {
            throw new ForbiddenException('Cannot manually set status to RENTING');
        }

        // Check for duplicate phone (excluding current tenant)
        if (updateTenantDto.phone) {
            const existingPhone = await this.tenantModel.findOne({
                _id: { $ne: id },
                ownerId: new Types.ObjectId(ownerId),
                phone: updateTenantDto.phone,
                isDeleted: false
            }).exec();
            if (existingPhone) {
                throw new ConflictException('PHONE_EXISTS');
            }
        }

        // Check for duplicate idCard (excluding current tenant)
        if (updateTenantDto.idCard) {
            const existingIdCard = await this.tenantModel.findOne({
                _id: { $ne: id },
                ownerId: new Types.ObjectId(ownerId),
                idCard: updateTenantDto.idCard,
                isDeleted: false
            }).exec();
            if (existingIdCard) {
                throw new ConflictException('ID_CARD_EXISTS');
            }
        }

        const updateData: any = { ...updateTenantDto };
        if (updateData.fullName) {
            updateData.fullNameNormalized = normalizeString(updateData.fullName);
        }
        
        // Convert currentRoomId to ObjectId if it's a string
        if (updateData.currentRoomId !== undefined) {
            if (updateData.currentRoomId === null) {
                updateData.currentRoomId = null;
            } else if (typeof updateData.currentRoomId === 'string') {
                updateData.currentRoomId = new Types.ObjectId(updateData.currentRoomId);
            }
            // If already ObjectId, it stays as is
        }
        
        const tenant = await this.tenantModel
            .findOneAndUpdate({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false }, { $set: updateData }, { new: true })
            .exec();
        if (!tenant) throw new NotFoundException('Tenant not found');
        return tenant;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        // H5 Fix: Check if tenant has active contract before deletion
        const tenant = await this.tenantModel.findOne({
            _id: id,
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false
        }).exec();
        if (!tenant) throw new NotFoundException('Tenant not found');

        if (tenant.status === TenantStatus.RENTING) {
            throw new BadRequestException('Cannot delete tenant with active contract. Terminate contract first.');
        }

        await this.tenantModel.updateOne(
            { _id: id },
            { $set: { isDeleted: true } }
        ).exec();
    }

    async getHistory(tenantId: string, ownerId: string, query: GetTenantHistoryDto) {
        // Verify tenant exists and belongs to owner
        await this.findOne(tenantId, ownerId);

        const { type, startDate, endDate, page = 1, limit = 10 } = query;
        const tenantObjectId = new Types.ObjectId(tenantId);

        // Build date filter
        const dateFilter: any = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
            dateFilter.$lte = new Date(endDate);
        }

        const baseFilter: any = {
            tenantId: tenantObjectId,
            isDeleted: false,
        };

        if (Object.keys(dateFilter).length > 0) {
            baseFilter.createdAt = dateFilter;
        }

        // Query collections based on type filter
        const shouldQueryContracts = !type || type === HistoryEventType.CONTRACT;
        const shouldQueryInvoices = !type || type === HistoryEventType.INVOICE;
        const shouldQueryPayments = !type || type === HistoryEventType.PAYMENT;

        // Build payment date filter (payments use paymentDate, not createdAt)
        const paymentFilter: any = {
            tenantId: tenantObjectId,
            isDeleted: false,
        };
        if (Object.keys(dateFilter).length > 0) {
            paymentFilter.paymentDate = dateFilter;
        }

        const [contracts, invoices, payments] = await Promise.all([
            shouldQueryContracts
                ? this.contractModel.find(baseFilter).populate('roomId', 'roomName roomCode').sort({ createdAt: -1 }).exec()
                : Promise.resolve([]),
            shouldQueryInvoices
                ? this.invoiceModel.find(baseFilter).sort({ createdAt: -1 }).exec()
                : Promise.resolve([]),
            shouldQueryPayments
                ? this.paymentModel.find(paymentFilter).populate('invoiceId', 'invoiceNumber').sort({ paymentDate: -1 }).exec()
                : Promise.resolve([]),
        ]);

        // Map to unified TenantHistoryEvent format
        const events: TenantHistoryEvent[] = [];

        for (const doc of contracts) {
            const d = doc as any;
            const room = d.roomId;
            const contractData: ContractHistoryData = {
                contractId: d._id.toString(),
                contractCode: d.contractCode || '',
                contractType: d.contractType,
                startDate: d.startDate,
                endDate: d.endDate,
                roomName: room?.roomName || '',
                rentPrice: d.rentPrice,
                status: d.status,
            };

            let title = 'Contract created';
            if (d.status === 'TERMINATED') title = 'Contract terminated';
            else if (d.status === 'EXPIRED') title = 'Contract expired';

            events.push({
                type: HistoryEventType.CONTRACT,
                date: d.createdAt,
                title,
                data: contractData,
            });
        }

        for (const doc of invoices) {
            const d = doc as any;
            const invoiceData: InvoiceHistoryData = {
                invoiceId: d._id.toString(),
                invoiceNumber: d.invoiceNumber,
                totalAmount: d.totalAmount,
                paidAmount: d.paidAmount,
                status: d.status,
                billingPeriod: d.billingPeriod,
                dueDate: d.dueDate,
            };

            events.push({
                type: HistoryEventType.INVOICE,
                date: d.createdAt,
                title: `Invoice #${d.invoiceNumber}`,
                data: invoiceData,
            });
        }

        for (const doc of payments) {
            const d = doc as any;
            const inv = d.invoiceId;
            const paymentData: PaymentHistoryData = {
                paymentId: d._id.toString(),
                amount: d.amount,
                paymentMethod: d.paymentMethod,
                paymentDate: d.paymentDate,
                invoiceNumber: inv?.invoiceNumber,
            };

            events.push({
                type: HistoryEventType.PAYMENT,
                date: d.paymentDate,
                title: 'Payment received',
                data: paymentData,
            });
        }

        // Sort all events by date descending
        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Apply pagination
        const total = events.length;
        const start = (page - 1) * limit;
        const paginatedEvents = events.slice(start, start + limit);

        return {
            data: paginatedEvents,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
