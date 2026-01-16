import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { CreateTenantDto, UpdateTenantDto, GetTenantsDto } from './dto/tenant.dto';
import { normalizeString } from '../../common/utils/string.util';
import { TenantStatus } from '../../common/constants/enums';

@Injectable()
export class TenantsService {
    constructor(@InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>) { }

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
            const normalizedSearch = normalizeString(search);
            if (normalizedSearch) {
                const searchRegex = new RegExp(normalizedSearch, 'i');
                filter.$or = [
                    { fullNameNormalized: searchRegex },
                    { code: new RegExp(search, 'i') },
                    { fullName: new RegExp(search, 'i') },
                    { phone: new RegExp(search, 'i') },
                    { idCard: new RegExp(search, 'i') }
                ];
            } else {
                // If special chars only or empty normalization, use regex on main fields
                const searchRegex = new RegExp(search, 'i');
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

        const updateData: any = { ...updateTenantDto };
        if (updateData.fullName) {
            updateData.fullNameNormalized = normalizeString(updateData.fullName);
        }
        const tenant = await this.tenantModel
            .findOneAndUpdate({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false }, { $set: updateData }, { new: true })
            .exec();
        if (!tenant) throw new NotFoundException('Tenant not found');
        return tenant;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        const result = await this.tenantModel.updateOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false }, { $set: { isDeleted: true } }).exec();
        if (result.matchedCount === 0) throw new NotFoundException('Tenant not found');
    }
}
