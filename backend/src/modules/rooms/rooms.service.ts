import { RoomStatus } from '@common/constants/enums';
import { escapeRegExp, normalizeString } from '@common/utils/string.util';
import { Building, BuildingDocument } from '@modules/buildings/schemas/building.schema';
import { CreateRoomDto, DashboardRoomsDto, GetRoomsDto, UpdateIndexesDto, UpdateRoomDto } from '@modules/rooms/dto/room.dto';
import { Room, RoomDocument } from '@modules/rooms/schemas/room.schema';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class RoomsService {
    constructor(
        @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
        @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    ) { }

    /**
     * Generate unique room code
     * Format: R-{timestamp}-{random4digits}
     */
    private generateRoomCode(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `R-${timestamp}-${random}`;
    }

    /**
     * Validate short-term price tiers:
     * - Each tier's fromValue must equal previous tier's toValue + 1
     * - All prices must be positive
     * - Last tier must have toValue = -1 (remaining)
     */
    private validateShortTermPrices(prices: { fromValue: number; toValue: number; price: number }[]): void {
        if (!prices || prices.length < 2) {
            throw new BadRequestException('Price table must have at least 2 tiers (first tier and remaining tier)');
        }

        // First tier must start from 1
        if (prices[0].fromValue !== 1) {
            throw new BadRequestException('First price tier must start from 1');
        }

        // Last tier must have toValue = -1
        const lastTier = prices[prices.length - 1];
        if (lastTier.toValue !== -1) {
            throw new BadRequestException('Last price tier must have toValue = -1 (remaining)');
        }

        // Validate continuity: each tier's fromValue = previous tier's toValue + 1
        for (let i = 1; i < prices.length; i++) {
            const prevTier = prices[i - 1];
            const currTier = prices[i];
            
            // Skip validation for last tier's fromValue check against non-remaining tier
            if (prevTier.toValue !== -1 && currTier.fromValue !== prevTier.toValue + 1) {
                throw new BadRequestException(
                    `Price tier ${i + 1} must start at ${prevTier.toValue + 1} (previous tier ends at ${prevTier.toValue})`
                );
            }

            // Each tier's toValue must be >= fromValue (except for remaining tier)
            if (currTier.toValue !== -1 && currTier.toValue < currTier.fromValue) {
                throw new BadRequestException(
                    `Price tier ${i + 1} end value (${currTier.toValue}) must be >= start value (${currTier.fromValue})`
                );
            }
        }

        // Non-last tiers must have valid toValue
        for (let i = 0; i < prices.length - 1; i++) {
            if (prices[i].toValue < prices[i].fromValue) {
                throw new BadRequestException(
                    `Price tier ${i + 1} end value (${prices[i].toValue}) must be >= start value (${prices[i].fromValue})`
                );
            }
        }
    }

    async create(ownerId: string, createRoomDto: CreateRoomDto): Promise<Room> {
        // Validate short-term prices if using TABLE mode
        if (
            createRoomDto.roomType === 'SHORT_TERM' &&
            (createRoomDto.shortTermPricingType === 'DAILY' || 
             (createRoomDto.shortTermPricingType === 'HOURLY' && createRoomDto.hourlyPricingMode === 'TABLE')) &&
            createRoomDto.shortTermPrices
        ) {
            this.validateShortTermPrices(createRoomDto.shortTermPrices);
        }

        // Auto-generate unique room code
        let roomCode = this.generateRoomCode();

        // Ensure uniqueness (retry if collision)
        let attempts = 0;
        while (attempts < 5) {
            const existing = await this.roomModel.findOne({ roomCode }).exec();
            if (!existing) break;
            roomCode = this.generateRoomCode();
            attempts++;
        }


        const room = new this.roomModel({
            ...createRoomDto,
            status: RoomStatus.AVAILABLE, // Force status to AVAILABLE
            nameNormalized: normalizeString(createRoomDto.roomName),
            ownerId: new Types.ObjectId(ownerId),
            buildingId: new Types.ObjectId(createRoomDto.buildingId),
            roomGroupId: createRoomDto.roomGroupId ? new Types.ObjectId(createRoomDto.roomGroupId) : undefined,
            roomCode
        });
        const savedRoom = await room.save();

        // Increment building totalRooms
        const building = await this.buildingModel.findById(createRoomDto.buildingId);
        if (building) {
            building.totalRooms = (building.totalRooms || 0) + 1;
            await building.save();
        }

        return savedRoom;
    }

    async findAll(ownerId: string, query: GetRoomsDto | string): Promise<any> {
        // Support backward compatibility or direct buildingId usage if needed, though DTO is preferred
        const filter: any = { ownerId: new Types.ObjectId(ownerId), isDeleted: false };

        // Handle if query is just a string (buildingId) - legacy support if any
        if (typeof query === 'string') {
            if (query) filter.buildingId = new Types.ObjectId(query);
            return this.roomModel.find(filter).populate('buildingId roomGroupId').sort({ createdAt: -1 }).exec();
        }

        const { buildingId, search, status, page = 1, limit = 10 } = query;

        if (buildingId) {
            filter.buildingId = new Types.ObjectId(buildingId);
        }

        if (status) {
            filter.status = status;
        }

        if (search) {
            const escapedSearch = escapeRegExp(search);
            const normalizedSearch = normalizeString(search);
            const escapedNormalizedSearch = escapeRegExp(normalizedSearch);
            if (escapedNormalizedSearch) {
                const searchRegex = new RegExp(escapedNormalizedSearch, 'i');
                const rawSearchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { nameNormalized: searchRegex },
                    { roomCode: rawSearchRegex },
                    { roomName: rawSearchRegex }
                ];
            } else {
                const searchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { roomName: searchRegex },
                    { roomCode: searchRegex }
                ];
            }
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.roomModel.find(filter)
                .populate('buildingId roomGroupId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.roomModel.countDocuments(filter).exec()
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

    async findOne(id: string, ownerId: string): Promise<Room> {
        const room = await this.roomModel
            .findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .exec();
        if (!room) throw new NotFoundException('Room not found');
        return room;
    }

    async update(id: string, ownerId: string, updateRoomDto: UpdateRoomDto): Promise<Room> {
        // First fetch the room to check current status
        const existingRoom = await this.roomModel
            .findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .exec();
        if (!existingRoom) throw new NotFoundException('Room not found');

        // Check for Status Lock
        if (updateRoomDto.status && updateRoomDto.status !== existingRoom.status) {
            if (existingRoom.status === RoomStatus.OCCUPIED || existingRoom.status === RoomStatus.DEPOSITED) {
                throw new BadRequestException('Cannot manually change status of an OCCUPIED or DEPOSITED room');
            }
        }

        // Prevent updating buildingId
        const dto = updateRoomDto as any;
        if (dto.buildingId) {
            delete dto.buildingId;
        }

        // Prevent changing status of OCCUPIED rooms
        if (existingRoom.status === 'OCCUPIED' && dto.status && dto.status !== 'OCCUPIED') {
            throw new BadRequestException('Cannot change status of occupied room');
        }

        // Convert roomGroupId to ObjectId if present
        if (dto.roomGroupId) {
            dto.roomGroupId = new Types.ObjectId(dto.roomGroupId);
        }

        if (dto.roomName) {
            (dto as any).nameNormalized = normalizeString(dto.roomName);
        }

        // Validate short-term prices if using TABLE mode
        const roomType = dto.roomType || existingRoom.roomType;
        const pricingType = dto.shortTermPricingType || existingRoom.shortTermPricingType;
        const hourlyMode = dto.hourlyPricingMode || existingRoom.hourlyPricingMode;
        
        if (
            roomType === 'SHORT_TERM' &&
            (pricingType === 'DAILY' || (pricingType === 'HOURLY' && hourlyMode === 'TABLE')) &&
            dto.shortTermPrices
        ) {
            this.validateShortTermPrices(dto.shortTermPrices);
        }

        const room = await this.roomModel
            .findOneAndUpdate(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: dto },
                { new: true }
            )
            .exec();
        if (!room) throw new NotFoundException('Room not found');
        return room;
    }

    async updateIndexes(id: string, ownerId: string, updateIndexesDto: UpdateIndexesDto): Promise<Room> {
        const room = await this.roomModel
            .findOneAndUpdate(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: updateIndexesDto },
                { new: true }
            )
            .exec();
        if (!room) throw new NotFoundException('Room not found');
        return room;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        // First find the room to get buildingId and check status
        const room = await this.roomModel
            .findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .exec();
        if (!room) throw new NotFoundException('Room not found');

        // Check if room is OCCUPIED
        if (room.status === 'OCCUPIED') {
            throw new BadRequestException('Cannot delete room with OCCUPIED status');
        }

        // Soft delete the room
        await this.roomModel.updateOne({ _id: id }, { $set: { isDeleted: true } }).exec();

        // Decrement building totalRooms
        const building = await this.buildingModel.findById(room.buildingId);
        if (building && building.totalRooms > 0) {
            building.totalRooms -= 1;
            await building.save();
        }
    }

    async updateStatus(id: string, ownerId: string, status: string): Promise<void> {
        await this.roomModel.updateOne(
            { _id: new Types.ObjectId(id), ownerId: new Types.ObjectId(ownerId), isDeleted: false },
            { $set: { status } }
        ).exec();
    }

    async getDashboard(ownerId: string, query: DashboardRoomsDto): Promise<any> {
        const filter: any = { ownerId: new Types.ObjectId(ownerId), isDeleted: false };

        if (query.buildingId) {
            filter.buildingId = new Types.ObjectId(query.buildingId);
        }

        if (query.status) {
            filter.status = query.status;
        }

        if (query.roomGroupIds) {
            // Support comma-separated room group IDs for multi-select
            const groupIds = query.roomGroupIds.split(',').filter(id => id.trim());
            if (groupIds.length > 0) {
                filter.roomGroupId = { $in: groupIds.map(id => new Types.ObjectId(id.trim())) };
            }
        }

        if (query.search) {
            const escapedSearch = escapeRegExp(query.search);
            const normalizedSearch = normalizeString(query.search);
            const escapedNormalizedSearch = escapeRegExp(normalizedSearch);
            if (escapedNormalizedSearch) {
                const searchRegex = new RegExp(escapedNormalizedSearch, 'i');
                const rawSearchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { nameNormalized: searchRegex },
                    { roomCode: rawSearchRegex },
                    { roomName: rawSearchRegex }
                ];
            } else {
                const searchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { roomName: searchRegex },
                    { roomCode: searchRegex }
                ];
            }
        }

        // Fetch rooms with populated room groups
        const rooms = await this.roomModel.aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'roomgroups',
                    localField: 'roomGroupId',
                    foreignField: '_id',
                    as: 'roomGroup'
                }
            },
            { $unwind: { path: '$roomGroup', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'contracts',
                    let: { roomId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$roomId', '$$roomId'] },
                                        { $in: ['$status', ['ACTIVE', 'DEPOSITED', 'DRAFT']] },
                                        { $eq: ['$isDeleted', false] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'tenants',
                                localField: 'tenantId',
                                foreignField: '_id',
                                as: 'tenant'
                            }
                        },
                        { $unwind: { path: '$tenant', preserveNullAndEmptyArrays: true } },
                        { $limit: 1 }
                    ],
                    as: 'activeContractArr'
                }
            },
            { $unwind: { path: '$activeContractArr', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    roomCode: 1,
                    roomName: 1,
                    floor: 1,
                    area: 1,
                    maxOccupancy: 1,
                    status: 1,
                    roomType: 1,
                    defaultRoomPrice: 1,
                    defaultElectricPrice: 1,
                    defaultWaterPrice: 1,
                    defaultTermMonths: 1,
                    shortTermPricingType: 1,
                    hourlyPricingMode: 1,
                    pricePerHour: 1,
                    fixedPrice: 1,
                    shortTermPrices: 1,
                    priceTableType: 1,
                    description: 1,
                    roomGroupId: {
                        _id: '$roomGroup._id',
                        name: '$roomGroup.name',
                        color: '$roomGroup.color'
                    },
                    activeContract: {
                        _id: '$activeContractArr._id',
                        contractCode: '$activeContractArr.contractCode',
                        endDate: '$activeContractArr.endDate',
                        contractType: '$activeContractArr.contractType',
                        rentPrice: '$activeContractArr.rentPrice',
                        shortTermPricingType: '$activeContractArr.shortTermPricingType',
                        hourlyPricingMode: '$activeContractArr.hourlyPricingMode',
                        pricePerHour: '$activeContractArr.pricePerHour',
                        fixedPrice: '$activeContractArr.fixedPrice',
                        shortTermPrices: '$activeContractArr.shortTermPrices',
                        priceTableType: '$activeContractArr.priceTableType',
                        electricityPrice: '$activeContractArr.electricityPrice',
                        waterPrice: '$activeContractArr.waterPrice',
                        serviceCharges: '$activeContractArr.serviceCharges',
                        depositAmount: '$activeContractArr.depositAmount',
                        startDate: '$activeContractArr.startDate',
                        paymentCycle: '$activeContractArr.paymentCycle',
                        paymentCycleMonths: '$activeContractArr.paymentCycleMonths',
                        paymentDueDay: '$activeContractArr.paymentDueDay',
                        notes: '$activeContractArr.notes',
                        tenantId: {
                            _id: '$activeContractArr.tenant._id',
                            fullName: '$activeContractArr.tenant.fullName',
                            phone: '$activeContractArr.tenant.phone'
                        }
                    }
                }
            },
            { $sort: { 'roomGroup.sortOrder': 1, sortOrder: 1, roomName: 1 } }
        ]).exec();

        // Group rooms by roomGroupId
        const groupMap = new Map<string, any>();
        const ungrouped: any[] = [];

        for (const room of rooms) {
            // Clean up empty activeContract
            if (!room.activeContract?._id) {
                room.activeContract = undefined;
            }
            // Clean up empty roomGroupId
            if (!room.roomGroupId?._id) {
                room.roomGroupId = undefined;
                ungrouped.push(room);
            } else {
                const groupId = room.roomGroupId._id.toString();
                if (!groupMap.has(groupId)) {
                    groupMap.set(groupId, {
                        _id: room.roomGroupId._id,
                        name: room.roomGroupId.name,
                        color: room.roomGroupId.color,
                        rooms: []
                    });
                }
                groupMap.get(groupId).rooms.push(room);
            }
        }

        return {
            groups: Array.from(groupMap.values()),
            ungrouped
        };
    }

    /**
     * Reorder rooms - update sortOrder and optionally roomGroupId
     * Used for drag-and-drop functionality
     */
    async reorderRooms(
        ownerId: string,
        items: { roomId: string; roomGroupId?: string | null; sortOrder: number }[]
    ): Promise<{ success: boolean; updated: number }> {
        const bulkOps = items.map(item => ({
            updateOne: {
                filter: {
                    _id: new Types.ObjectId(item.roomId),
                    ownerId: new Types.ObjectId(ownerId),
                    isDeleted: false
                },
                update: {
                    $set: {
                        sortOrder: item.sortOrder,
                        ...(item.roomGroupId !== undefined && {
                            roomGroupId: item.roomGroupId ? new Types.ObjectId(item.roomGroupId) : null
                        })
                    }
                }
            }
        }));

        const result = await this.roomModel.bulkWrite(bulkOps);
        return {
            success: true,
            updated: result.modifiedCount
        };
    }
}
