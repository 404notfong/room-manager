import { ActivateContractDto, CreateContractDto, GetContractsDto, TerminateContractDto, UpdateContractDto } from '@modules/contracts/dto/contract.dto';
import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ContractStatus, ContractType, RoomStatus, RoomType, ShortTermPricingType, TenantStatus } from '@common/constants/enums';
import { escapeRegExp } from '@common/utils/string.util';
import { RoomsService } from '@modules/rooms/rooms.service';
import { ServicesService } from '@modules/services/services.service';
import { TenantsService } from '@modules/tenants/tenants.service';
import { addMonths, getDaysInMonth, setDate } from 'date-fns';

@Injectable()
export class ContractsService {
    private readonly logger = new Logger(ContractsService.name);

    constructor(
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
        private roomsService: RoomsService,
        private tenantsService: TenantsService,
        private servicesService: ServicesService,
    ) { }

    /**
     * Generate unique contract code
     * Format: HD-{timestamp}-{random4digits}
     */
    private generateContractCode(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `HD-${timestamp}-${random}`;
    }

    /**
     * Calculate the next payment date based on startDate, paymentCycle, and paymentDueDay
     * @param startDate The contract start date
     * @param cycleMonths Number of months in payment cycle (1, 2, 3, 6, 12, etc.)
     * @param dueDay The day of month payment is due (1-31)
     * @returns The calculated next payment date
     */
    private calculateNextPaymentDate(startDate: Date, cycleMonths: number, dueDay: number): Date {
        // Add cycle months to start date
        const targetMonth = addMonths(startDate, cycleMonths);
        
        // Handle months with fewer days (e.g., Feb 30 -> Feb 28)
        const daysInTargetMonth = getDaysInMonth(targetMonth);
        const actualDueDay = Math.min(dueDay, daysInTargetMonth);
        
        // Set the due day on target month
        return setDate(targetMonth, actualDueDay);
    }

    async validateCreateContract(ownerId: string, dto: CreateContractDto, isUpdate = false) {
        this.logger.log(`Validating contract ${isUpdate ? 'update' : 'creation'} for room: ${dto.roomId}`);

        // 1. Building/Room Validation
        const room = await this.roomsService.findOne(dto.roomId, ownerId);
        if (!room) throw new NotFoundException('Room not found or access denied');

        // 2. Tenant Validation (skip status check for updates since tenant is already DEPOSITED/RENTING)
        if (!dto.tenantId && !dto.newTenant) {
            throw new BadRequestException('Either an existing tenant or a new tenant must be provided');
        }
        if (dto.tenantId) {
            this.logger.log(`Validating existing tenant: ${dto.tenantId}`);
            const tenant = await this.tenantsService.findOne(dto.tenantId, ownerId);
            if (!tenant) throw new NotFoundException('Tenant not found or access denied');
            // Only check ACTIVE status for new contracts, not updates
            if (!isUpdate && tenant.status !== TenantStatus.ACTIVE) {
                this.logger.warn(`Tenant ${dto.tenantId} status check failed: ${tenant.status} (isUpdate: ${isUpdate})`);
                throw new BadRequestException(`Tenant must be in ACTIVE status to create a contract. Current status: ${tenant.status}`);
            }
        } else if (dto.newTenant) {
            this.logger.log(`Validating new tenant: ${dto.newTenant.fullName}`);
            if (!dto.newTenant.fullName || !dto.newTenant.phone || !dto.newTenant.idCard) {
                throw new BadRequestException('New tenant must have Full Name, Phone, and ID Card');
            }
        }

        // 3. Pricing Configuration Validation
        const roomType = dto.roomType || RoomType.LONG_TERM;
        this.logger.log(`Validating pricing configuration for type: ${roomType}`);

        if (roomType === RoomType.LONG_TERM) {
            if (dto.rentPrice === undefined || dto.rentPrice < 0) throw new BadRequestException('Rent price is required for long term');
            if (dto.electricityPrice === undefined) throw new BadRequestException('Electricity price is required');
            if (dto.initialElectricIndex === undefined || dto.initialElectricIndex < 0) throw new BadRequestException('Initial electric index is required');
            if (dto.initialWaterIndex === undefined || dto.initialWaterIndex < 0) throw new BadRequestException('Initial water index is required');
            if (!dto.paymentCycle) throw new BadRequestException('Payment cycle is required');
        } else {
            // Short term
            if (!dto.shortTermPricingType) throw new BadRequestException('Short term pricing type is required');

            if (dto.shortTermPricingType === ShortTermPricingType.HOURLY) {
                if (!dto.hourlyPricingMode) throw new BadRequestException('Hourly pricing mode is required');
                if (dto.hourlyPricingMode === 'PER_HOUR' && (!dto.pricePerHour || dto.pricePerHour <= 0)) {
                    throw new BadRequestException('Price per hour is required');
                }
            } else if (dto.shortTermPricingType === ShortTermPricingType.FIXED) {
                this.logger.log(`Validating FIXED short term pricing: fixedPrice=${dto.fixedPrice}`);
                if (!dto.fixedPrice || dto.fixedPrice <= 0) throw new BadRequestException('Fixed price is required');
            }

            // Table validation (DAILY or HOURLY/TABLE)
            if (dto.shortTermPricingType === ShortTermPricingType.DAILY ||
                (dto.shortTermPricingType === ShortTermPricingType.HOURLY && dto.hourlyPricingMode === 'TABLE')) {
                if (!dto.shortTermPrices || dto.shortTermPrices.length < 2) {
                    throw new BadRequestException('Price table must have at least 2 tiers (first tier and remaining tier)');
                }

                // First tier must start from 1
                if (dto.shortTermPrices[0].fromValue !== 1) {
                    throw new BadRequestException('First price tier must start from 1');
                }

                // Last tier must have toValue = -1
                const lastTier = dto.shortTermPrices[dto.shortTermPrices.length - 1];
                if (lastTier.toValue !== -1) {
                    throw new BadRequestException('Last price tier must have toValue = -1 (remaining)');
                }

                dto.shortTermPrices.forEach((tier, index) => {
                    // Price must be > 0
                    if (tier.price <= 0) throw new BadRequestException(`Price in tier ${index + 1} must be > 0`);
                    
                    // toValue must be >= fromValue (except for remaining tier with toValue = -1)
                    if (tier.toValue !== -1 && tier.toValue < tier.fromValue) {
                        throw new BadRequestException(`Invalid range in tier ${index + 1}: end value (${tier.toValue}) must be >= start value (${tier.fromValue})`);
                    }
                    
                    // Next tier's fromValue must equal previous tier's toValue + 1
                    if (index > 0) {
                        const prevTier = dto.shortTermPrices![index - 1];
                        if (prevTier.toValue !== -1 && tier.fromValue !== prevTier.toValue + 1) {
                            throw new BadRequestException(`Price tier ${index + 1} must start at ${prevTier.toValue + 1} (previous tier ends at ${prevTier.toValue})`);
                        }
                    }
                });
            }
        }

        // 4. Mandatory Fields
        this.logger.log('Validating mandatory fields (deposit, start date)');
        if (dto.depositAmount === undefined || dto.depositAmount < 0) throw new BadRequestException('Deposit amount is required');
        if (!dto.startDate) {
            this.logger.warn(`Start date check failed: ${dto.startDate}`);
            throw new BadRequestException('Start date is required');
        }

        if (dto.endDate) {
            const start = new Date(dto.startDate);
            const end = new Date(dto.endDate);
            
            // Basic check
            if (end <= start) {
                throw new BadRequestException('End Date must be after Start Date');
            }

            // Long Term Check: End Date > Start Date + Payment Cycle
            if (dto.contractType === ContractType.LONG_TERM) {
                const cycleMonths = dto.paymentCycleMonths || 1;
                // Calculate minimum end date (Start + Cycle)
                const minEndDate = new Date(start);
                minEndDate.setMonth(minEndDate.getMonth() + cycleMonths);
                
                // If end date is ON or BEFORE the minEndDate, it's invalid
                // Requirement: strictly greater than date(start + cycle)
                if (end <= minEndDate) {
                    throw new BadRequestException(`End Date must be after the first payment cycle (${cycleMonths} months)`);
                }
            }
        }
        // 5. Service Charge Validation
        if (dto.serviceCharges && dto.serviceCharges.length > 0) {
            this.logger.log(`Validating ${dto.serviceCharges.length} service charges`);
            for (const sc of dto.serviceCharges) {
                if (!sc.name) throw new BadRequestException('Service name is required');
                if (sc.amount === undefined || sc.amount < 0) throw new BadRequestException(`Amount for service ${sc.name} is required`);

                if (sc.serviceId) {
                    const systemService = await this.servicesService.findOne(sc.serviceId, ownerId);
                    if (!systemService) throw new NotFoundException(`System service ${sc.name} not found`);
                    // We allow quantity to be changed, but name/amount should match for predefined services if they come from the system
                    // However, sometimes users might overwrite prices. 
                    // Based on user requirement: "Dịch vụ nếu chọn các dịch vụ có sẵn, chỉ được sửa số lượng"
                    // We should enforce this on backend too.
                    if (systemService.name.trim() !== sc.name.trim()) {
                        throw new BadRequestException(`Service name mismatch for ${sc.name}. Expected '${systemService.name}', got '${sc.name}'`);
                    }
                    if (systemService.priceType === 'FIXED' && Math.abs(systemService.fixedPrice - sc.amount) > 0.01) {
                        throw new BadRequestException(`Service price mismatch for ${sc.name}. Expected ${systemService.fixedPrice}, got ${sc.amount}`);
                    }
                }
            }
        }
    }

    async create(ownerId: string, createContractDto: CreateContractDto): Promise<Contract> {
        this.logger.log(`Creating new contract. Payload keys: ${Object.keys(createContractDto).join(', ')}`);
        await this.validateCreateContract(ownerId, createContractDto);

        let tenantId = createContractDto.tenantId;

        if (createContractDto.newTenant) {
            const tenant = await this.tenantsService.create(ownerId, createContractDto.newTenant);
            tenantId = (tenant as any)._id.toString();
        }

        // Calculate nextPaymentDate for long-term contracts
        let nextPaymentDate: Date | undefined;
        const contractType = createContractDto.contractType || (createContractDto.roomType as any) || ContractType.LONG_TERM;
        if (contractType === ContractType.LONG_TERM && createContractDto.startDate) {
            const cycleMonths = createContractDto.paymentCycleMonths || 1;
            const dueDay = createContractDto.paymentDueDay || new Date(createContractDto.startDate).getDate();
            nextPaymentDate = this.calculateNextPaymentDate(new Date(createContractDto.startDate), cycleMonths, dueDay);
            this.logger.log(`Calculated nextPaymentDate: ${nextPaymentDate.toISOString()}`);
        }

        const contract = new this.contractModel({
            ...createContractDto,
            contractCode: this.generateContractCode(),
            roomId: new Types.ObjectId(createContractDto.roomId),
            tenantId: new Types.ObjectId(tenantId),
            ownerId: new Types.ObjectId(ownerId),
            status: createContractDto.status || ContractStatus.ACTIVE,
            contractType: contractType,
            nextPaymentDate: nextPaymentDate
        });
        const savedContract = await contract.save();

        // Sync initial meter readings to room's current indexes (for long-term contracts)
        if (contractType === ContractType.LONG_TERM && 
            (createContractDto.initialElectricIndex !== undefined || createContractDto.initialWaterIndex !== undefined)) {
            this.logger.log(`Syncing meter readings to room: electric=${createContractDto.initialElectricIndex}, water=${createContractDto.initialWaterIndex}`);
            await this.roomsService.updateIndexes(createContractDto.roomId, ownerId, {
                currentElectricIndex: createContractDto.initialElectricIndex,
                currentWaterIndex: createContractDto.initialWaterIndex
            });
        }

        // If it's a draft, set Room and Tenant status to DEPOSITED
        if (savedContract.status === ContractStatus.DRAFT) {
            this.logger.log(`Contract ${savedContract.contractCode} created as DRAFT. Setting status to DEPOSITED.`);

            // Update Room Status to DEPOSITED
            await this.roomsService.updateStatus(createContractDto.roomId, ownerId, RoomStatus.DEPOSITED);

            // Update Tenant Status to DEPOSITED
            await this.tenantsService.update(tenantId, ownerId, {
                status: TenantStatus.DEPOSITED,
                currentRoomId: new Types.ObjectId(createContractDto.roomId),
                moveInDate: createContractDto.startDate.toISOString()
            }, true);

            return savedContract;
        }

        // Update Room Status to OCCUPIED
        await this.roomsService.updateStatus(createContractDto.roomId, ownerId, RoomStatus.OCCUPIED);

        // Update Tenant Status to RENTING
        await this.tenantsService.update(tenantId, ownerId, {
            status: TenantStatus.RENTING,
            currentRoomId: new Types.ObjectId(createContractDto.roomId),
            moveInDate: createContractDto.startDate.toISOString()
        }, true);

        return savedContract;
    }

    async activate(id: string, ownerId: string, activateContractDto: ActivateContractDto): Promise<Contract> {
        const contract = await this.contractModel.findOne({ _id: new Types.ObjectId(id), ownerId: new Types.ObjectId(ownerId), isDeleted: false }).exec();
        if (!contract) throw new NotFoundException('Contract not found');
        if (contract.status !== ContractStatus.DRAFT) {
            throw new BadRequestException('Only draft contracts can be activated');
        }

        contract.status = ContractStatus.ACTIVE;
        contract.startDate = new Date(activateContractDto.startDate);
        if (activateContractDto.endDate) {
            const start = new Date(activateContractDto.startDate);
            const end = new Date(activateContractDto.endDate);
            if (end <= start) {
                throw new BadRequestException('End Date must be after Start Date');
            }
            contract.endDate = end;
        } else {
            contract.endDate = undefined;
        }

        // Calculate nextPaymentDate for long-term contracts
        if (contract.contractType === ContractType.LONG_TERM) {
            const cycleMonths = contract.paymentCycleMonths || 1;
            const dueDay = contract.paymentDueDay || contract.startDate.getDate();
            contract.nextPaymentDate = this.calculateNextPaymentDate(contract.startDate, cycleMonths, dueDay);
            this.logger.log(`Calculated nextPaymentDate on activate: ${contract.nextPaymentDate.toISOString()}`);
        }

        const savedContract = await contract.save();

        // Perform status updates: Transition from DEPOSITED to OCCUPIED/RENTING
        await this.roomsService.updateStatus(contract.roomId.toString(), ownerId, RoomStatus.OCCUPIED);

        await this.tenantsService.update(contract.tenantId.toString(), ownerId, {
            status: TenantStatus.RENTING,
            currentRoomId: contract.roomId,
            moveInDate: activateContractDto.startDate.toISOString()
        }, true);

        return savedContract;
    }

    async findAll(ownerId: string, query: GetContractsDto): Promise<any> {
        const { search, buildingId } = query;
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;

        const pipeline: any[] = [
            { $match: { ownerId: new Types.ObjectId(ownerId), isDeleted: false } },
            // Lookup Room
            {
                $lookup: {
                    from: 'rooms',
                    localField: 'roomId',
                    foreignField: '_id',
                    as: 'roomId'
                }
            },
            { $unwind: '$roomId' },
            // Lookup Room's Building
            {
                $lookup: {
                    from: 'buildings',
                    localField: 'roomId.buildingId',
                    foreignField: '_id',
                    as: 'roomId.buildingId'
                }
            },
            { $unwind: { path: '$roomId.buildingId', preserveNullAndEmptyArrays: true } },
            // Lookup Tenant
            {
                $lookup: {
                    from: 'tenants',
                    localField: 'tenantId',
                    foreignField: '_id',
                    as: 'tenantId'
                }
            },
            { $unwind: { path: '$tenantId', preserveNullAndEmptyArrays: true } },
        ];

        // Filter by Building
        if (buildingId) {
            pipeline.push({
                $match: { 'roomId.buildingId._id': new Types.ObjectId(buildingId) }
            });
        }

        // Filter by Status
        if (query.status) {
            pipeline.push({
                $match: { status: query.status }
            });
        }

        // Search Filter
        if (search) {
            const escapedSearch = escapeRegExp(search);
            pipeline.push({
                $match: {
                    $or: [
                        { contractCode: { $regex: escapedSearch, $options: 'i' } },
                        { 'tenantId.fullName': { $regex: escapedSearch, $options: 'i' } },
                        { 'roomId.roomName': { $regex: escapedSearch, $options: 'i' } },
                        { 'roomId.roomCode': { $regex: escapedSearch, $options: 'i' } }
                    ]
                }
            });
        }


        // Pagination Facet
        pipeline.push({
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit }
                ],
                total: [
                    { $count: 'count' }
                ]
            }
        });

        const [result] = await this.contractModel.aggregate(pipeline).exec();
        const data = result.data;
        const total = result.total[0]?.count || 0;

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

    async findOne(id: string, ownerId: string): Promise<Contract> {
        const contract = await this.contractModel.findOne({
            _id: new Types.ObjectId(id),
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false,
        }).populate({ path: 'roomId', populate: { path: 'buildingId' } }).populate('tenantId').exec();

        if (!contract) throw new NotFoundException('Contract not found');
        return contract;
    }

    async update(id: string, ownerId: string, updateContractDto: UpdateContractDto): Promise<Contract> {
        // Find existing contract
        const existingContract = await this.contractModel.findOne({
            _id: new Types.ObjectId(id),
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false
        }).populate({ path: 'roomId', populate: { path: 'buildingId' } }).exec();
        if (!existingContract) throw new NotFoundException('Contract not found');

        // Only DRAFT and ACTIVE contracts can be edited
        if (existingContract.status !== ContractStatus.DRAFT && existingContract.status !== ContractStatus.ACTIVE) {
            throw new BadRequestException('Only draft or active contracts can be edited');
        }

        const isActiveContract = existingContract.status === ContractStatus.ACTIVE;

        // For ACTIVE contracts: strip immutable fields
        if (isActiveContract) {
            delete (updateContractDto as any).roomId;
            delete (updateContractDto as any).buildingId;
            delete (updateContractDto as any).contractType;
            delete (updateContractDto as any).roomType;
            delete (updateContractDto as any).startDate;

            // Check if trying to change initial meter indexes
            const isChangingElectric = updateContractDto.initialElectricIndex !== undefined
                && updateContractDto.initialElectricIndex !== existingContract.initialElectricIndex;
            const isChangingWater = updateContractDto.initialWaterIndex !== undefined
                && updateContractDto.initialWaterIndex !== existingContract.initialWaterIndex;

            if (isChangingElectric || isChangingWater) {
                const invoiceCount = await this.invoiceModel.countDocuments({
                    contractId: new Types.ObjectId(id),
                    isDeleted: { $ne: true },
                }).exec();
                if (invoiceCount > 0) {
                    throw new BadRequestException('Cannot change initial meter indexes after invoices have been created');
                }
            }
        }

        // Note: roomId and tenantId are not in UpdateContractDto, so they cannot be changed

        // Validate like create contract (reuse validation logic)
        const resolvedRoomType = updateContractDto.roomType || existingContract.roomType || (existingContract.contractType as unknown as RoomType);

        this.logger.log(`Constructing validation DTO for contract update: ${id}`);
        const roomIdStr = (existingContract.roomId as any)._id?.toString() || existingContract.roomId.toString();
        const buildingId = (updateContractDto as any).buildingId || (existingContract.roomId as any).buildingId?.toString() || '';

        const validationDto: CreateContractDto = {
            roomId: roomIdStr,
            tenantId: existingContract.tenantId.toString(),
            buildingId: buildingId,
            contractType: updateContractDto.contractType || existingContract.contractType,
            roomType: resolvedRoomType,
            startDate: updateContractDto.startDate ? new Date(updateContractDto.startDate as any) : existingContract.startDate,
            endDate: (updateContractDto.endDate as any === null || updateContractDto.endDate as any === '')
                ? undefined
                : (updateContractDto.endDate ? new Date(updateContractDto.endDate as any) : existingContract.endDate),
            depositAmount: updateContractDto.depositAmount ?? existingContract.depositAmount,
            rentPrice: updateContractDto.rentPrice ?? existingContract.rentPrice,
            electricityPrice: updateContractDto.electricityPrice ?? existingContract.electricityPrice,
            waterPrice: updateContractDto.waterPrice ?? existingContract.waterPrice,
            paymentCycle: updateContractDto.paymentCycle || existingContract.paymentCycle,
            paymentCycleMonths: updateContractDto.paymentCycleMonths ?? existingContract.paymentCycleMonths,
            paymentDueDay: updateContractDto.paymentDueDay ?? existingContract.paymentDueDay,
            initialElectricIndex: updateContractDto.initialElectricIndex ?? existingContract.initialElectricIndex,
            initialWaterIndex: updateContractDto.initialWaterIndex ?? existingContract.initialWaterIndex,
            serviceCharges: updateContractDto.serviceCharges ?? existingContract.serviceCharges,
            shortTermPrices: updateContractDto.shortTermPrices ?? existingContract.shortTermPrices,
            shortTermPricingType: updateContractDto.shortTermPricingType || existingContract.shortTermPricingType,
            hourlyPricingMode: updateContractDto.hourlyPricingMode || existingContract.hourlyPricingMode,
            pricePerHour: updateContractDto.pricePerHour ?? existingContract.pricePerHour,
            fixedPrice: updateContractDto.fixedPrice ?? existingContract.fixedPrice,
        };
        this.logger.log(`Validation DTO: ${JSON.stringify(validationDto)}`);
        await this.validateCreateContract(ownerId, validationDto, true); // isUpdate = true to skip tenant status check

        // Prepare update data
        const updateData: any = { ...updateContractDto };

        // Ensure we don't overwrite immutable IDs through update
        delete updateData.roomId;
        delete updateData.tenantId;
        delete updateData.buildingId;

        // Sync contractType if roomType changed
        if (updateData.roomType && !updateData.contractType) {
            updateData.contractType = updateData.roomType;
        }

        // Check if we're activating the contract
        const isActivating = updateContractDto.status === ContractStatus.ACTIVE;

        const contract = await this.contractModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(id), ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: updateData },
                { new: true }
            )
            .exec();
        if (!contract) throw new NotFoundException('Contract not found');

        // If activating from DRAFT -> ACTIVE, update room and tenant status
        if (isActivating) {
            this.logger.log(`Activating contract ${contract.contractCode} from DRAFT to ACTIVE`);

            await this.roomsService.updateStatus(contract.roomId.toString(), ownerId, RoomStatus.OCCUPIED);

            await this.tenantsService.update(contract.tenantId.toString(), ownerId, {
                status: TenantStatus.RENTING,
                currentRoomId: contract.roomId,
                moveInDate: contract.startDate?.toISOString()
            }, true);
        }

        return contract;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        const contract = await this.contractModel.findOne({ _id: new Types.ObjectId(id), ownerId: new Types.ObjectId(ownerId), isDeleted: false }).exec();
        if (!contract) throw new NotFoundException('Contract not found');

        if (contract.status !== ContractStatus.DRAFT) {
            throw new BadRequestException('Only draft contracts can be deleted');
        }

        // Revert Room status to AVAILABLE
        await this.roomsService.updateStatus(contract.roomId.toString(), ownerId, RoomStatus.AVAILABLE);

        // Revert Tenant status to ACTIVE and clear assignments
        await this.tenantsService.update(contract.tenantId.toString(), ownerId, {
            status: TenantStatus.ACTIVE,
            currentRoomId: null,
            moveInDate: null
        }, true);

        await this.contractModel.updateOne({ _id: id }, { $set: { isDeleted: true } }).exec();
    }

    /**
     * Terminate a contract (Long-term or Short-term)
     * - Sets contract status to CLOSED
     * - Sets terminatedAt date
     * - Updates room status to AVAILABLE
     * - Optionally closes the tenant (or keeps ACTIVE for potential re-rental)
     * @param id Contract ID
     * @param ownerId Owner ID
     * @param terminateDto Termination details
     * @param closeTenant Whether to set tenant status to CLOSED
     */
    async terminate(
        id: string, 
        ownerId: string, 
        terminateDto: TerminateContractDto,
        closeTenant: boolean = false
    ): Promise<Contract> {
        const contract = await this.contractModel.findOne({ 
            _id: new Types.ObjectId(id), 
            ownerId: new Types.ObjectId(ownerId), 
            isDeleted: false 
        }).exec();
        
        if (!contract) throw new NotFoundException('Contract not found');
        
        // Only ACTIVE contracts can be terminated
        if (contract.status !== ContractStatus.ACTIVE) {
            throw new BadRequestException('Only active contracts can be terminated');
        }

        // Update contract
        contract.status = ContractStatus.TERMINATED;
        contract.endDate = new Date(terminateDto.endDate);
        contract.terminatedAt = new Date();
        
        const savedContract = await contract.save();
        this.logger.log(`Contract ${contract.contractCode} terminated. endDate: ${contract.endDate}, terminatedAt: ${contract.terminatedAt}`);

        // Update room status to AVAILABLE
        await this.roomsService.updateStatus(contract.roomId.toString(), ownerId, RoomStatus.AVAILABLE);

        // Update tenant status
        if (closeTenant) {
            // Close tenant completely
            await this.tenantsService.update(contract.tenantId.toString(), ownerId, {
                status: TenantStatus.CLOSED,
                currentRoomId: null,
                moveOutDate: terminateDto.endDate.toISOString()
            }, true);
        } else {
            // Keep tenant ACTIVE for potential re-rental
            await this.tenantsService.update(contract.tenantId.toString(), ownerId, {
                status: TenantStatus.ACTIVE,
                currentRoomId: null,
                moveOutDate: terminateDto.endDate.toISOString()
            }, true);
        }

        return savedContract;
    }
}
