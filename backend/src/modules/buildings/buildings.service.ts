import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Building, BuildingDocument } from './schemas/building.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';
import { RoomGroup, RoomGroupDocument } from '../room-groups/schemas/room-group.schema';
import { CreateBuildingDto, UpdateBuildingDto } from './dto/building.dto';
import { BuildingQueryDto } from './dto/building-query.dto';
import { normalizeString } from '../../common/utils/string.util';

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
            const normalizedSearch = normalizeString(search);
            // Search by code OR normalized name (covers fuzzy name search)
            if (normalizedSearch) {
                const searchRegex = new RegExp(normalizedSearch, 'i');
                filter.$or = [
                    { nameNormalized: searchRegex },
                    { code: new RegExp(search, 'i') },
                    { 'address.street': new RegExp(search, 'i') },
                    { 'address.ward': new RegExp(search, 'i') },
                    { 'address.district': new RegExp(search, 'i') },
                    { 'address.city': new RegExp(search, 'i') },
                ];
            } else {
                const searchRegex = new RegExp(search, 'i');
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
        const buildings = await this.buildingModel.find({ ownerId, isDeleted: false }).exec();
        let updatedCount = 0;

        for (const building of buildings) {
            const count = await this.roomModel.countDocuments({
                buildingId: building._id,
                ownerId: new Types.ObjectId(ownerId),
                isDeleted: false
            });

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

        // Check if building has any OCCUPIED rooms
        const occupiedRoomsCount = await this.roomModel
            .countDocuments({
                buildingId: new Types.ObjectId(id),
                ownerId: new Types.ObjectId(ownerId),
                status: 'OCCUPIED',
                isDeleted: false
            })
            .exec();

        if (occupiedRoomsCount > 0) {
            throw new BadRequestException('Cannot delete building with occupied rooms');
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
