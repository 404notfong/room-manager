import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import { CreateServiceDto, UpdateServiceDto, GetServicesDto } from './dto/service.dto';
import { normalizeString } from '../../common/utils/string.util';

@Injectable()
export class ServicesService {
    constructor(@InjectModel(Service.name) private serviceModel: Model<ServiceDocument>) { }

    private generateCode(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `SV-${timestamp}-${random}`;
    }

    async create(ownerId: string, createServiceDto: CreateServiceDto): Promise<Service> {
        let code = this.generateCode();

        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 5) {
            const existing = await this.serviceModel.findOne({ code, ownerId: new Types.ObjectId(ownerId) }).exec();
            if (!existing) break;
            code = this.generateCode() + Math.floor(Math.random() * 10);
            attempts++;
        }

        const service = new this.serviceModel({
            ...createServiceDto,
            nameNormalized: normalizeString(createServiceDto.name),
            code,
            ownerId: new Types.ObjectId(ownerId),
            buildingIds: createServiceDto.buildingIds?.map(id => new Types.ObjectId(id)) || [],
        });
        return service.save();
    }

    async findAll(ownerId: string, query?: GetServicesDto): Promise<any> {
        const filter: any = { ownerId: new Types.ObjectId(ownerId), isDeleted: false };
        const { search, buildingId, page = 1, limit = 10 } = query || {};

        if (buildingId) {
            filter.$or = [
                { buildingScope: 'ALL' },
                { buildingScope: 'SPECIFIC', buildingIds: new Types.ObjectId(buildingId) }
            ];
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

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.serviceModel.find(filter)
                .populate('buildingIds', 'name code')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.serviceModel.countDocuments(filter).exec()
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

    async findOne(id: string, ownerId: string): Promise<Service> {
        const service = await this.serviceModel
            .findOne({ _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .populate('buildingIds', 'name code')
            .exec();
        if (!service) throw new NotFoundException('Service not found');
        return service;
    }

    async findByBuilding(buildingId: string, ownerId: string): Promise<Service[]> {
        return this.serviceModel
            .find({
                ownerId: new Types.ObjectId(ownerId),
                isDeleted: false,
                $or: [
                    { buildingScope: 'ALL' },
                    { buildingScope: 'SPECIFIC', buildingIds: new Types.ObjectId(buildingId) }
                ]
            })
            .sort({ name: 1 })
            .exec();
    }

    async update(id: string, ownerId: string, updateServiceDto: UpdateServiceDto): Promise<Service> {
        const updateData: any = { ...updateServiceDto };
        if (updateData.name) {
            updateData.nameNormalized = normalizeString(updateData.name);
        }
        if (updateServiceDto.buildingIds) {
            updateData.buildingIds = updateServiceDto.buildingIds.map(id => new Types.ObjectId(id));
        }

        const service = await this.serviceModel
            .findOneAndUpdate(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: updateData },
                { new: true }
            )
            .populate('buildingIds', 'name code')
            .exec();
        if (!service) throw new NotFoundException('Service not found');
        return service;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        const result = await this.serviceModel
            .updateOne(
                { _id: id, ownerId: new Types.ObjectId(ownerId), isDeleted: false },
                { $set: { isDeleted: true } }
            )
            .exec();
        if (result.matchedCount === 0) throw new NotFoundException('Service not found');
    }
}
