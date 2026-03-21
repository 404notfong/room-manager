import { ContractStatus, ContractType, InvoiceType, PriceTableType, RoomStatus, ShortTermPricingType, TenantStatus } from '@common/constants/enums';
import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { CreateInvoiceDto, UpdateInvoiceDto } from '@modules/invoices/dto/invoice.dto';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { Room, RoomDocument } from '@modules/rooms/schemas/room.schema';
import { Tenant, TenantDocument } from '@modules/tenants/schemas/tenant.schema';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { addMonths, getDaysInMonth, setDate } from 'date-fns';
import { Model, Types } from 'mongoose';

@Injectable()
export class InvoicesService {
    private readonly logger = new Logger(InvoicesService.name);

    constructor(
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
        @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
        @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    ) { }

    /**
     * Calculate the next payment date based on current startDate, paymentCycle, and paymentDueDay
     */
    private calculateNextPaymentDate(fromDate: Date, cycleMonths: number, dueDay: number): Date {
        const targetMonth = addMonths(fromDate, cycleMonths);
        const daysInTargetMonth = getDaysInMonth(targetMonth);
        const actualDueDay = Math.min(dueDay, daysInTargetMonth);
        return setDate(targetMonth, actualDueDay);
    }

    /**
     * Calculate short-term rental amount based on pricing type and duration
     * Supports: HOURLY (per hour or price table), DAILY (price table), FIXED (fixed price)
     */
    private calculateShortTermAmount(
        contract: Contract,
        totalHours: number,
        totalDays: number
    ): { amount: number; calculation: string } {
        const pricingType = contract.shortTermPricingType;
        
        if (pricingType === ShortTermPricingType.FIXED) {
            return {
                amount: contract.fixedPrice || 0,
                calculation: `Fixed price: ${contract.fixedPrice}`
            };
        }

        if (pricingType === ShortTermPricingType.HOURLY) {
            // Check if using simple per-hour or price table
            if (contract.hourlyPricingMode === 'PER_HOUR') {
                const amount = totalHours * (contract.pricePerHour || 0);
                return {
                    amount,
                    calculation: `${totalHours} hours x ${contract.pricePerHour} = ${amount}`
                };
            }
            
            // Price table mode (progressive or flat)
            return this.calculateFromPriceTable(
                contract.shortTermPrices || [],
                totalHours,
                contract.priceTableType || PriceTableType.PROGRESSIVE,
                'hours'
            );
        }

        if (pricingType === ShortTermPricingType.DAILY) {
            // Always uses price table for daily
            return this.calculateFromPriceTable(
                contract.shortTermPrices || [],
                totalDays,
                contract.priceTableType || PriceTableType.PROGRESSIVE,
                'days'
            );
        }

        return { amount: 0, calculation: 'Unknown pricing type' };
    }

    /**
     * Calculate amount from price table using progressive or flat pricing
     */
    private calculateFromPriceTable(
        priceTiers: Array<{ fromValue: number; toValue: number; price: number }>,
        quantity: number,
        tableType: PriceTableType,
        unit: string
    ): { amount: number; calculation: string } {
        if (!priceTiers || priceTiers.length === 0) {
            return { amount: 0, calculation: 'No price tiers defined' };
        }

        // Sort tiers by 'fromValue' ascending
        const sortedTiers = [...priceTiers].sort((a, b) => a.fromValue - b.fromValue);

        if (tableType === PriceTableType.FLAT) {
            // M8 Fix: Handle -1 sentinel in flat pricing
            const matchingTier = sortedTiers.find(tier =>
                quantity >= tier.fromValue && (tier.toValue === -1 || quantity <= tier.toValue)
            );
            if (matchingTier) {
                const amount = quantity * matchingTier.price;
                const tierLabel = matchingTier.toValue === -1 ? `${matchingTier.fromValue}+` : `${matchingTier.fromValue}-${matchingTier.toValue}`;
                return {
                    amount,
                    calculation: `${quantity} ${unit} x ${matchingTier.price} (tier ${tierLabel}) = ${amount}`
                };
            }
            // If quantity exceeds all tiers, use the last tier's price
            const lastTier = sortedTiers[sortedTiers.length - 1];
            const amount = quantity * lastTier.price;
            return {
                amount,
                calculation: `${quantity} ${unit} x ${lastTier.price} (last tier) = ${amount}`
            };
        }

        // Progressive: Sum up charges for each tier
        let remainingQty = quantity;
        let totalAmount = 0;
        const calculations: string[] = [];

        for (const tier of sortedTiers) {
            if (remainingQty <= 0) break;
            
            // H4 Fix: Handle -1 sentinel ("remaining" tier) correctly
            const tierRange = tier.toValue === -1 ? remainingQty : (tier.toValue - tier.fromValue + 1);
            const qtyInTier = Math.min(remainingQty, tierRange);
            const tierAmount = qtyInTier * tier.price;
            
            totalAmount += tierAmount;
            calculations.push(`${qtyInTier} ${unit} x ${tier.price}`);
            remainingQty -= qtyInTier;
        }

        // If there's remaining quantity beyond defined tiers, use last tier's price
        if (remainingQty > 0 && sortedTiers.length > 0) {
            const lastTier = sortedTiers[sortedTiers.length - 1];
            const extraAmount = remainingQty * lastTier.price;
            totalAmount += extraAmount;
            calculations.push(`${remainingQty} ${unit} x ${lastTier.price} (overflow)`);
        }

        return {
            amount: totalAmount,
            calculation: `Progressive: ${calculations.join(' + ')} = ${totalAmount}`
        };
    }


    async create(ownerId: string, createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
        this.logger.log(`Creating invoice for contract: ${createInvoiceDto.contractId}`);

        // 1. Check for duplicate invoice (same contract, same billing period, same invoice type)
        const existingInvoice = await this.invoiceModel.findOne({
            contractId: new Types.ObjectId(createInvoiceDto.contractId),
            'billingPeriod.month': createInvoiceDto.month,
            'billingPeriod.year': createInvoiceDto.year,
            invoiceType: createInvoiceDto.invoiceType || InvoiceType.REGULAR,
            isDeleted: false
        }).exec();

        if (existingInvoice) {
            throw new BadRequestException(
                `Invoice for ${createInvoiceDto.month}/${createInvoiceDto.year} already exists for this contract`
            );
        }

        // 2. Fetch contract for snapshot and validation
        const contract = await this.contractModel.findOne({
            _id: new Types.ObjectId(createInvoiceDto.contractId),
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false
        }).exec();

        if (!contract) {
            throw new NotFoundException('Contract not found');
        }

        if (contract.status !== ContractStatus.ACTIVE) {
            throw new BadRequestException('Can only create invoices for active contracts');
        }

        // 3. Calculate amounts based on contract type
        let electricityUsed = 0;
        let electricityAmount = 0;
        let waterUsed = 0;
        let waterAmount = 0;
        let rentAmount = createInvoiceDto.rentAmount;
        let shortTermCalculation = '';

        const isShortTerm = contract.roomType === 'SHORT_TERM';

        if (isShortTerm) {
            // Short-term: Calculate rent from duration and pricing
            const totalHours = createInvoiceDto.totalHours || 0;
            const totalDays = createInvoiceDto.totalDays || 0;
            
            const result = this.calculateShortTermAmount(contract, totalHours, totalDays);
            rentAmount = result.amount;
            shortTermCalculation = result.calculation;
            
            this.logger.log(`Short-term calculation: ${shortTermCalculation}`);
        } else {
            // Long-term: Calculate utilities from meter readings
            // Frontend sends initialElectricIndex/initialWaterIndex as the current meter reading
            // Fallback to currentElectricIndex/currentWaterIndex for backward compatibility
            const currentElectric = createInvoiceDto.initialElectricIndex ?? createInvoiceDto.currentElectricIndex ?? 0;
            const currentWater = createInvoiceDto.initialWaterIndex ?? createInvoiceDto.currentWaterIndex ?? 0;
            const previousElectric = createInvoiceDto.previousElectricIndex ?? 0;
            const previousWater = createInvoiceDto.previousWaterIndex ?? 0;

            electricityUsed = Math.max(0, currentElectric - previousElectric);
            electricityAmount = electricityUsed * (createInvoiceDto.electricityPrice || 0);

            waterUsed = Math.max(0, currentWater - previousWater);
            waterAmount = waterUsed * (createInvoiceDto.waterPrice || 0);

            // Normalize: store current values in both fields for consistency
            createInvoiceDto.currentElectricIndex = currentElectric;
            createInvoiceDto.currentWaterIndex = currentWater;
        }

        const serviceTotal = (createInvoiceDto.serviceCharges || []).reduce((sum, charge) => sum + (charge.amount * (charge.quantity || 1)), 0);
        
        // Calculate adjustments (additional charges - discounts)
        const adjustments = [...(createInvoiceDto.adjustments || [])];

        // Auto-deduct deposit for short-term invoices
        if (isShortTerm && contract.depositAmount && contract.depositAmount > 0) {
            adjustments.push({
                description: 'Deposit deduction',
                amount: contract.depositAmount,
                isDiscount: true,
            });
            this.logger.log(`Auto-deducting deposit: ${contract.depositAmount}`);
        }

        const adjustmentTotal = adjustments.reduce((sum, adj) => {
            return adj.isDiscount ? sum - adj.amount : sum + adj.amount;
        }, 0);

        const totalAmount = Math.max(0, rentAmount + electricityAmount + waterAmount + serviceTotal + adjustmentTotal);

        const invoiceNumber = `INV-${Date.now()}`;

        // 4. Create contract snapshot if not provided
        const contractSnapshot = createInvoiceDto.contractSnapshot || {
            contractCode: contract.contractCode,
            contractType: contract.contractType,
            roomType: contract.roomType,
            rentPrice: contract.rentPrice,
            electricityPrice: contract.electricityPrice,
            waterPrice: contract.waterPrice,
            paymentCycle: contract.paymentCycle,
            paymentCycleMonths: contract.paymentCycleMonths,
            serviceCharges: contract.serviceCharges,
            // Short-term specific
            shortTermPricingType: contract.shortTermPricingType,
            shortTermPrices: contract.shortTermPrices,
            priceTableType: contract.priceTableType,
            pricePerHour: contract.pricePerHour,
            fixedPrice: contract.fixedPrice,
            depositAmount: contract.depositAmount,
            // Calculation details
            ...(isShortTerm && { shortTermCalculation }),
        };

        // 5. Create invoice
        const invoice = new this.invoiceModel({
            ...createInvoiceDto,
            adjustments,
            ownerId: new Types.ObjectId(ownerId),
            contractId: new Types.ObjectId(createInvoiceDto.contractId),
            roomId: new Types.ObjectId(createInvoiceDto.roomId),
            tenantId: new Types.ObjectId(createInvoiceDto.tenantId),
            invoiceNumber,
            invoiceType: createInvoiceDto.invoiceType || InvoiceType.REGULAR,
            billingPeriod: { month: createInvoiceDto.month, year: createInvoiceDto.year },
            rentAmount,
            electricityUsed,
            electricityAmount,
            waterUsed,
            waterAmount,
            totalAmount,
            remainingAmount: totalAmount,
            contractSnapshot,
            // Short-term specific fields
            ...(isShortTerm && {
                checkInTime: createInvoiceDto.checkInTime,
                checkOutTime: createInvoiceDto.checkOutTime,
                totalHours: createInvoiceDto.totalHours,
                totalDays: createInvoiceDto.totalDays,
            }),
        });

        const savedInvoice = await invoice.save();
        this.logger.log(`Invoice ${invoiceNumber} created. Total: ${totalAmount}`);

        // 6. Update room's current meter readings (for long-term contracts)
        if (contract.contractType === ContractType.LONG_TERM) {
            // Update room's current meter readings with the values from this invoice
            const newElectricIndex = createInvoiceDto.currentElectricIndex ?? createInvoiceDto.initialElectricIndex;
            const newWaterIndex = createInvoiceDto.currentWaterIndex ?? createInvoiceDto.initialWaterIndex;
            if (newElectricIndex !== undefined || newWaterIndex !== undefined) {
                const updateFields: Record<string, number> = {};
                if (newElectricIndex !== undefined) updateFields.currentElectricIndex = newElectricIndex;
                if (newWaterIndex !== undefined) updateFields.currentWaterIndex = newWaterIndex;
                await this.roomModel.updateOne(
                    { _id: new Types.ObjectId(createInvoiceDto.roomId) },
                    { $set: updateFields }
                ).exec();
                this.logger.log(`Room meter readings updated: electric=${newElectricIndex}, water=${newWaterIndex}`);
            }

            // 7. Update contract's nextPaymentDate (for REGULAR invoices only)
            if (createInvoiceDto.invoiceType !== InvoiceType.FINAL) {
                const cycleMonths = contract.paymentCycleMonths || 1;
                const dueDay = contract.paymentDueDay || contract.startDate.getDate();
                const currentNextPayment = contract.nextPaymentDate || contract.startDate;
                const newNextPaymentDate = this.calculateNextPaymentDate(currentNextPayment, cycleMonths, dueDay);
                
                await this.contractModel.updateOne(
                    { _id: contract._id },
                    { $set: { nextPaymentDate: newNextPaymentDate } }
                ).exec();
                this.logger.log(`Contract nextPaymentDate updated to: ${newNextPaymentDate.toISOString()}`);
            }
        }

        // 8. For short-term contracts: auto-terminate after invoice creation
        if (isShortTerm) {
            // Terminate contract
            await this.contractModel.updateOne(
                { _id: contract._id },
                {
                    $set: {
                        status: ContractStatus.TERMINATED,
                        endDate: new Date(),
                        terminatedAt: new Date(),
                    }
                }
            ).exec();
            this.logger.log(`Short-term contract ${contract.contractCode} auto-terminated after invoice creation`);

            // Set room to AVAILABLE
            await this.roomModel.updateOne(
                { _id: new Types.ObjectId(createInvoiceDto.roomId) },
                { $set: { status: RoomStatus.AVAILABLE } }
            ).exec();
            this.logger.log(`Room ${createInvoiceDto.roomId} set to AVAILABLE`);

            // Set tenant to ACTIVE + clear currentRoomId
            const tenantId = contract.tenantId?.toString() || createInvoiceDto.tenantId;
            if (tenantId) {
                await this.tenantModel.updateOne(
                    { _id: new Types.ObjectId(tenantId) },
                    {
                        $set: {
                            status: TenantStatus.ACTIVE,
                            currentRoomId: null,
                            moveOutDate: new Date().toISOString(),
                        }
                    }
                ).exec();
                this.logger.log(`Tenant ${tenantId} set to ACTIVE, currentRoomId cleared`);
            }
        }

        return savedInvoice;
    }

    async findAll(ownerId: string, query?: { page?: number; limit?: number; search?: string; buildingId?: string }) {
        const { page = 1, limit = 10, search, buildingId } = query || {};
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 10;
        const skip = (pageNum - 1) * limitNum;

        const filter: any = { ownerId: new Types.ObjectId(ownerId), isDeleted: false };

        // Build the aggregation pipeline for search + building filter
        const pipeline: any[] = [
            { $match: filter },
            // Populate roomId
            { $lookup: { from: 'rooms', localField: 'roomId', foreignField: '_id', as: 'roomId' } },
            { $unwind: { path: '$roomId', preserveNullAndEmptyArrays: true } },
            // Populate roomId.buildingId
            { $lookup: { from: 'buildings', localField: 'roomId.buildingId', foreignField: '_id', as: 'roomId.buildingId' } },
            { $unwind: { path: '$roomId.buildingId', preserveNullAndEmptyArrays: true } },
            // Populate tenantId
            { $lookup: { from: 'tenants', localField: 'tenantId', foreignField: '_id', as: 'tenantId' } },
            { $unwind: { path: '$tenantId', preserveNullAndEmptyArrays: true } },
            // Populate contractId
            { $lookup: { from: 'contracts', localField: 'contractId', foreignField: '_id', as: 'contractId' } },
            { $unwind: { path: '$contractId', preserveNullAndEmptyArrays: true } },
        ];

        // Building filter
        if (buildingId) {
            pipeline.push({ $match: { 'roomId.buildingId._id': new Types.ObjectId(buildingId) } });
        }

        // Search filter
        if (search) {
            const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { invoiceNumber: searchRegex },
                        { 'tenantId.fullName': searchRegex },
                        { 'roomId.roomCode': searchRegex },
                    ],
                },
            });
        }

        // M2 Fix: Use $facet to run count + data in a single pipeline
        pipeline.push({
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limitNum }
                ],
                total: [
                    { $count: 'count' }
                ]
            }
        });

        const [result] = await this.invoiceModel.aggregate(pipeline).exec();
        const data = result.data;
        const total = result.total[0]?.count || 0;

        return {
            data,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    }

    async findOne(id: string, ownerId: string): Promise<Invoice> {
        const invoice = await this.invoiceModel.findOne({ 
            _id: new Types.ObjectId(id), 
            ownerId: new Types.ObjectId(ownerId), 
            isDeleted: false 
        })
            .populate('contractId tenantId')
            .populate({ path: 'roomId', populate: { path: 'buildingId' } })
            .exec();
        if (!invoice) throw new NotFoundException('Invoice not found');
        return invoice;
    }

    async findByContract(contractId: string, ownerId: string): Promise<Invoice[]> {
        return this.invoiceModel.find({ 
            contractId: new Types.ObjectId(contractId), 
            ownerId: new Types.ObjectId(ownerId), 
            isDeleted: false 
        })
        .sort({ 'billingPeriod.year': -1, 'billingPeriod.month': -1 })
        .exec();
    }

    async update(id: string, ownerId: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
        const updateData: any = { ...updateInvoiceDto };

        if (updateInvoiceDto.paidAmount !== undefined) {
            const invoice = await this.findOne(id, ownerId);
            updateData.remainingAmount = invoice.totalAmount - updateInvoiceDto.paidAmount;
        }

        // Recalculate adjustments if provided
        if (updateInvoiceDto.adjustments !== undefined) {
            const invoice = await this.findOne(id, ownerId);
            const adjustmentTotal = (updateInvoiceDto.adjustments || []).reduce((sum, adj) => {
                return adj.isDiscount ? sum - adj.amount : sum + adj.amount;
            }, 0);
            
            // Recalculate total (base amount + adjustments)
            const baseAmount = invoice.rentAmount + invoice.electricityAmount + invoice.waterAmount + 
                (invoice.serviceCharges || []).reduce((sum, s) => sum + s.amount, 0);
            updateData.totalAmount = baseAmount + adjustmentTotal;
            updateData.remainingAmount = updateData.totalAmount - (invoice.paidAmount || 0);
        }

        const invoice = await this.invoiceModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(id), ownerId: new Types.ObjectId(ownerId), isDeleted: false }, 
                { $set: updateData }, 
                { new: true }
            )
            .exec();
        if (!invoice) throw new NotFoundException('Invoice not found');
        return invoice;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        // H2 Fix: Check for payments and reverse meter readings before deleting
        const invoice = await this.invoiceModel.findOne({
            _id: new Types.ObjectId(id),
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false
        }).exec();
        if (!invoice) throw new NotFoundException('Invoice not found');

        // Prevent deleting invoices that have payments
        if (invoice.paidAmount && invoice.paidAmount > 0) {
            throw new BadRequestException('Cannot delete invoice with existing payments. Delete payments first.');
        }

        // Reverse room meter readings if this was a long-term invoice
        const contract = await this.contractModel.findById(invoice.contractId).exec();
        if (contract && contract.contractType === ContractType.LONG_TERM && invoice.roomId) {
            // Find the previous invoice to restore meter readings
            const previousInvoice = await this.invoiceModel.findOne({
                contractId: invoice.contractId,
                _id: { $ne: invoice._id },
                isDeleted: false,
            }).sort({ 'billingPeriod.year': -1, 'billingPeriod.month': -1 }).exec();

            const restoreElectric = previousInvoice?.currentElectricIndex ?? contract.initialElectricIndex ?? 0;
            const restoreWater = previousInvoice?.currentWaterIndex ?? contract.initialWaterIndex ?? 0;

            await this.roomModel.updateOne(
                { _id: invoice.roomId },
                { $set: { currentElectricIndex: restoreElectric, currentWaterIndex: restoreWater } }
            ).exec();
            this.logger.log(`Invoice ${id} deleted. Room meter readings restored: electric=${restoreElectric}, water=${restoreWater}`);
        }

        await this.invoiceModel.updateOne(
            { _id: new Types.ObjectId(id) },
            { $set: { isDeleted: true } }
        ).exec();
    }
}
