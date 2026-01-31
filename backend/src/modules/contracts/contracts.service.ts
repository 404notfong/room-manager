import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { CreateContractDto, UpdateContractDto, GetContractsDto, ActivateContractDto } from '@modules/contracts/dto/contract.dto';

import { RoomsService } from '@modules/rooms/rooms.service';
import { TenantsService } from '@modules/tenants/tenants.service';
import { ServicesService } from '@modules/services/services.service';
import { RoomStatus, RoomType, ShortTermPricingType, TenantStatus, ContractStatus, ContractType } from '@common/constants/enums';
import { normalizeString, escapeRegExp } from '@common/utils/string.util';

@Injectable()
export class ContractsService {
    private readonly logger = new Logger(ContractsService.name);

    constructor(
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
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
                if (!dto.shortTermPrices || dto.shortTermPrices.length === 0) {
                    throw new BadRequestException('Price table (shortTermPrices) is required');
                }

                dto.shortTermPrices.forEach((tier, index) => {
                    if (tier.price <= 0) throw new BadRequestException(`Price in tier ${index + 1} must be > 0`);
                    if (tier.toValue !== -1 && tier.toValue < tier.fromValue) {
                        throw new BadRequestException(`Invalid range in tier ${index + 1}`);
                    }
                    if (index > 0) {
                        const prevTier = dto.shortTermPrices![index - 1];
                        if (tier.fromValue !== prevTier.toValue) {
                            throw new BadRequestException(`Sequence gap at tier ${index + 1}`);
                        }
                    }
                });

                const lastTier = dto.shortTermPrices[dto.shortTermPrices.length - 1];
                if (!lastTier || lastTier.toValue !== -1) {
                    throw new BadRequestException('The last price tier must end with -1 (infinity)');
                }
            }
        }

        // 4. Mandatory Fields
        this.logger.log('Validating mandatory fields (deposit, start date)');
        if (dto.depositAmount === undefined || dto.depositAmount < 0) throw new BadRequestException('Deposit amount is required');
        if (!dto.startDate) {
            this.logger.warn(`Start date check failed: ${dto.startDate}`);
            throw new BadRequestException('Start date is required');
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

        const contract = new this.contractModel({
            ...createContractDto,
            contractCode: this.generateContractCode(),
            roomId: new Types.ObjectId(createContractDto.roomId),
            tenantId: new Types.ObjectId(tenantId),
            ownerId: new Types.ObjectId(ownerId),
            status: createContractDto.status || ContractStatus.ACTIVE,
            contractType: createContractDto.contractType || (createContractDto.roomType as any) || ContractType.LONG_TERM
        });
        const savedContract = await contract.save();

        // If it's a draft, set Room and Tenant status to DEPOSITED
        if (savedContract.status === ContractStatus.DRAFT) {
            this.logger.log(`Contract ${savedContract.contractCode} created as DRAFT. Setting status to DEPOSITED.`);

            // Update Room Status to DEPOSITED
            await this.roomsService.updateStatus(createContractDto.roomId, ownerId, RoomStatus.DEPOSITED);

            // Update Tenant Status to DEPOSITED
            await this.tenantsService.update(tenantId, ownerId, {
                status: TenantStatus.DEPOSITED,
                currentRoomId: createContractDto.roomId,
                moveInDate: createContractDto.startDate.toISOString()
            }, true);

            return savedContract;
        }

        // Update Room Status to OCCUPIED
        await this.roomsService.updateStatus(createContractDto.roomId, ownerId, RoomStatus.OCCUPIED);

        // Update Tenant Status to RENTING
        await this.tenantsService.update(tenantId, ownerId, {
            status: TenantStatus.RENTING,
            currentRoomId: createContractDto.roomId,
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
            contract.endDate = new Date(activateContractDto.endDate);
        } else {
            contract.endDate = undefined;
        }
        const savedContract = await contract.save();

        // Perform status updates: Transition from DEPOSITED to OCCUPIED/RENTING
        await this.roomsService.updateStatus(contract.roomId.toString(), ownerId, RoomStatus.OCCUPIED);

        await this.tenantsService.update(contract.tenantId.toString(), ownerId, {
            status: TenantStatus.RENTING,
            currentRoomId: contract.roomId.toString(),
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

        // Only DRAFT contracts can be edited
        if (existingContract.status !== ContractStatus.DRAFT) {
            throw new BadRequestException('Only draft contracts can be edited');
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
                currentRoomId: contract.roomId.toString(),
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
}
