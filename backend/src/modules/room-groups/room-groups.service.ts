import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoomGroup, RoomGroupDocument } from './schemas/room-group.schema';
import { CreateRoomGroupDto, UpdateRoomGroupDto, GetRoomGroupsDto } from './dto/room-group.dto';
import { normalizeString } from '../../common/utils/string.util';

@Injectable()
export class RoomGroupsService {
    constructor(@InjectModel(RoomGroup.name) private roomGroupModel: Model<RoomGroupDocument>) { }

    private generateCode(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `GP-${timestamp}-${random}`;
    }

    async create(ownerId: string, createRoomGroupDto: CreateRoomGroupDto): Promise<RoomGroup> {
        let code = this.generateCode();

        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 5) {
            const existing = await this.roomGroupModel.findOne({ code, ownerId: new Types.ObjectId(ownerId) }).exec();
            if (!existing) break;
            code = this.generateCode() + Math.floor(Math.random() * 10);
            attempts++;
        }

        const roomGroup = new this.roomGroupModel({
            ...createRoomGroupDto,
            nameNormalized: normalizeString(createRoomGroupDto.name),
            code,
            ownerId: new Types.ObjectId(ownerId),
            buildingId: new Types.ObjectId(createRoomGroupDto.buildingId),
        });
        return roomGroup.save();
    }

    async findAll(ownerId: string, query?: GetRoomGroupsDto): Promise<any> {
        const filter: any = { ownerId: new Types.ObjectId(ownerId), isDeleted: false };
        const { buildingId, search, isActive, page = 1, limit = 10 } = query || {};

        if (buildingId) {
            filter.buildingId = new Types.ObjectId(buildingId);
        }

        if (search) {
            const normalizedSearch = normalizeString(search);
            if (normalizedSearch) {
                const searchRegex = new RegExp(normalizedSearch, 'i');
                filter.$or = [
                    { nameNormalized: searchRegex },
                    { code: new RegExp(search, 'i') },
                    { name: new RegExp(search, 'i') }
                ];
            } else {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { code: { $regex: search, $options: 'i' } }
                ];
            }
        }

        if (isActive !== undefined) {
            filter.isActive = isActive;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.roomGroupModel.find(filter)
                .populate('buildingId')
                .sort({ sortOrder: 1, name: 1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.roomGroupModel.countDocuments(filter).exec()
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

    async findOne(id: string, ownerId: string): Promise<RoomGroup> {
        const roomGroup = await this.roomGroupModel
            .findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .exec();
        if (!roomGroup) throw new NotFoundException('Room group not found');
        return roomGroup;
    }

    async update(id: string, ownerId: string, updateRoomGroupDto: UpdateRoomGroupDto): Promise<RoomGroup> {
        const updateData: any = { ...updateRoomGroupDto };
        if (updateData.name) {
            updateData.nameNormalized = normalizeString(updateData.name);
        }
        if (updateData.buildingId) {
            updateData.buildingId = new Types.ObjectId(updateData.buildingId);
        }

        const roomGroup = await this.roomGroupModel
            .findOneAndUpdate(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: updateData },
                { new: true }
            )
            .exec();
        if (!roomGroup) throw new NotFoundException('Room group not found');
        return roomGroup;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        const result = await this.roomGroupModel
            .updateOne(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: { isDeleted: true } }
            )
            .exec();
        if (result.matchedCount === 0) throw new NotFoundException('Room group not found');
    }
}
