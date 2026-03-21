import { escapeRegExp, normalizeString } from '@common/utils/string.util';
import { BuildingQueryDto } from '@modules/buildings/dto/building-query.dto';
import { CreateBuildingDto, UpdateBuildingDto } from '@modules/buildings/dto/building.dto';
import { Building, BuildingDocument } from '@modules/buildings/schemas/building.schema';
import { RoomGroup, RoomGroupDocument } from '@modules/room-groups/schemas/room-group.schema';
import { Room, RoomDocument } from '@modules/rooms/schemas/room.schema';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class BuildingsService {
    constructor(
        @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
        @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
        @InjectModel(RoomGroup.name) private roomGroupModel: Model<RoomGroupDocument>,
    ) { }

    /**
     * Generate unique building code
     * Format: B-{timestamp}-{random4digits}
     */
    private generateBuildingCode(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `B-${timestamp}-${random}`;
    }

    async create(ownerId: string, createBuildingDto: CreateBuildingDto): Promise<Building> {
        let code = this.generateBuildingCode();

        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 5) {
            const existing = await this.buildingModel.findOne({ code }).exec();
            if (!existing) break;
            code = this.generateBuildingCode() + Math.floor(Math.random() * 10);
            attempts++;
        }

        const building = new this.buildingModel({
            ...createBuildingDto,
            nameNormalized: normalizeString(createBuildingDto.name),
            ownerId: new Types.ObjectId(ownerId),
            code
        });
        return building.save();
    }

    async findAll(ownerId: string, query: BuildingQueryDto) {
        const { page = 1, limit = 10, search } = query;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 10;
        const skip = (pageNum - 1) * limitNum;

        const filter: any = {
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false
        };

        if (search) {
            const escapedSearch = escapeRegExp(search);
            const normalizedSearch = normalizeString(search);
            const escapedNormalizedSearch = escapeRegExp(normalizedSearch);
            // Search by code OR normalized name (covers fuzzy name search)
            if (escapedNormalizedSearch) {
                const searchRegex = new RegExp(escapedNormalizedSearch, 'i');
                const rawSearchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { nameNormalized: searchRegex },
                    { code: rawSearchRegex },
                    { 'address.street': rawSearchRegex },
                    { 'address.ward': rawSearchRegex },
                    { 'address.district': rawSearchRegex },
                    { 'address.city': rawSearchRegex },
                ];
            } else {
                const searchRegex = new RegExp(escapedSearch, 'i');
                filter.$or = [
                    { name: searchRegex },
                    { code: searchRegex },
                ];
            }
        }

        const [data, total] = await Promise.all([
            this.buildingModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .exec(),
            this.buildingModel.countDocuments(filter).exec()
        ]);

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

    async syncRoomCounts(ownerId: string): Promise<{ updated: number }> {
        // M1 Fix: Use single aggregation instead of N+1 queries
        const roomCounts = await this.roomModel.aggregate([
            { $match: { ownerId: new Types.ObjectId(ownerId), isDeleted: false } },
            { $group: { _id: '$buildingId', count: { $sum: 1 } } }
        ]).exec();

        const countMap = new Map<string, number>();
        for (const rc of roomCounts) {
            countMap.set(rc._id.toString(), rc.count);
        }

        const buildings = await this.buildingModel.find({ ownerId, isDeleted: false }).exec();
        let updatedCount = 0;

        for (const building of buildings) {
            const count = countMap.get(building._id.toString()) || 0;
            if (building.totalRooms !== count) {
                building.totalRooms = count;
                await building.save();
                updatedCount++;
            }
        }

        return { updated: updatedCount };
    }

    async findOne(id: string, ownerId: string): Promise<Building> {
        const building = await this.buildingModel
            .findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .exec();

        if (!building) {
            throw new NotFoundException('Building not found');
        }

        return building;
    }

    async update(id: string, ownerId: string, updateBuildingDto: UpdateBuildingDto): Promise<Building> {
        const updateData: any = { ...updateBuildingDto };

        if (updateData.name) {
            updateData.nameNormalized = normalizeString(updateData.name);
        }

        const building = await this.buildingModel
            .findOneAndUpdate(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: updateData },
                { new: true },
            )
            .exec();

        if (!building) {
            throw new NotFoundException('Building not found');
        }

        return building;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        // Check if building exists
        const building = await this.buildingModel
            .findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .exec();

        if (!building) {
            throw new NotFoundException('Building not found');
        }

        // H3 Fix: Check if building has any OCCUPIED or DEPOSITED rooms (rooms with active contracts)
        const activeRoomsCount = await this.roomModel
            .countDocuments({
                buildingId: new Types.ObjectId(id),
                ownerId: new Types.ObjectId(ownerId),
                status: { $in: ['OCCUPIED', 'DEPOSITED'] },
                isDeleted: false
            })
            .exec();

        if (activeRoomsCount > 0) {
            throw new BadRequestException('Cannot delete building with occupied or deposited rooms. Terminate contracts first.');
        }

        // Cascade delete: soft delete all rooms in this building
        await this.roomModel
            .updateMany(
                {
                    buildingId: new Types.ObjectId(id),
                    ownerId: new Types.ObjectId(ownerId),
                    isDeleted: false
                },
                { $set: { isDeleted: true } }
            )
            .exec();

        // Cascade delete: soft delete all room groups in this building
        await this.roomGroupModel
            .updateMany(
                {
                    buildingId: new Types.ObjectId(id),
                    ownerId: new Types.ObjectId(ownerId),
                    isDeleted: false
                },
                { $set: { isDeleted: true } }
            )
            .exec();

        // Finally, soft delete the building
        await this.buildingModel
            .updateOne(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: { isDeleted: true } }
            )
            .exec();
    }
}
