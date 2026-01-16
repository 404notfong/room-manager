import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RoomStatus, RoomType, ShortTermPricingType } from '../../../common/constants/enums';

export type RoomDocument = Room & Document;

// Sub-schema for short-term pricing tiers (time range + price)
@Schema({ _id: false })
export class ShortTermPriceTier {
    @Prop({ required: true })
    fromValue: number;  // Starting hour/day

    @Prop({ required: true })
    toValue: number;    // Ending hour/day

    @Prop({ required: true })
    price: number;
}

export const ShortTermPriceTierSchema = SchemaFactory.createForClass(ShortTermPriceTier);

@Schema({ timestamps: true })
export class Room {
    @Prop({ type: Types.ObjectId, ref: 'Building', required: true, index: true })
    buildingId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'RoomGroup', index: true })
    roomGroupId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    ownerId: Types.ObjectId;

    @Prop({ required: true, trim: true, unique: true, index: true })
    roomCode: string;

    @Prop({ required: true, trim: true })
    roomName: string;

    @Prop({ trim: true, index: true })
    nameNormalized: string;

    @Prop({ default: 1 })
    floor: number;

    @Prop({ default: 0 })
    area: number;

    // Room type: Long-term (Trọ) or Short-term (Ngắn hạn)
    @Prop({ type: String, enum: RoomType, required: true, default: RoomType.LONG_TERM })
    roomType: RoomType;

    // === Long-term room fields (Trọ) ===
    @Prop({ default: 0 })
    defaultElectricPrice: number;  // Giá điện mặc định / số

    @Prop({ default: 0 })
    defaultWaterPrice: number;     // Giá nước mặc định / số

    @Prop({ default: 0 })
    defaultRoomPrice: number;      // Giá phòng mặc định

    @Prop({ default: 1 })
    defaultTermMonths: number;     // Kỳ hạn mặc định (tháng)

    // === Short-term room fields (Ngắn hạn) ===
    @Prop({ type: String, enum: ShortTermPricingType })
    shortTermPricingType: ShortTermPricingType;

    @Prop({ type: String, enum: ['PER_HOUR', 'TABLE'] })
    hourlyPricingMode: string;     // Phương thức tính giờ: PER_HOUR hoặc TABLE

    @Prop({ default: 0 })
    pricePerHour: number;          // Giá mỗi giờ (nếu chọn PER_HOUR)

    @Prop({ type: [ShortTermPriceTierSchema], default: [] })
    shortTermPrices: ShortTermPriceTier[];  // Bảng giá theo giờ/ngày

    @Prop({ default: 0 })
    fixedPrice: number;            // Giá cố định (nếu chọn FIXED)

    // === Other fields ===
    @Prop({ type: String, enum: RoomStatus, default: RoomStatus.AVAILABLE })
    status: RoomStatus;

    @Prop({ default: 0 })
    currentElectricIndex: number;

    @Prop({ default: 0 })
    currentWaterIndex: number;

    @Prop({ type: [String], default: [] })
    amenities: string[];

    @Prop({ trim: true })
    description: string;

    @Prop({ type: [String], default: [] })
    images: string[];

    @Prop({ default: false })
    isDeleted: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ buildingId: 1, isDeleted: 1 });
RoomSchema.index({ ownerId: 1, status: 1, isDeleted: 1 });
RoomSchema.index({ roomCode: 1 });
