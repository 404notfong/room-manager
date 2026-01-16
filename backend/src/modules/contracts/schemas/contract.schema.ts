import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContractType, ContractStatus, PaymentCycle, RoomType, ShortTermPricingType } from '../../../common/constants/enums';
import { ShortTermPriceTierSchema, ShortTermPriceTier } from '../../rooms/schemas/room.schema';

export type ContractDocument = Contract & Document;

@Schema({ timestamps: true })
export class Contract {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    ownerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
    roomId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
    tenantId: Types.ObjectId;

    @Prop({ unique: true, sparse: true, index: true })
    contractCode: string;

    @Prop({ type: String, enum: ContractType, default: ContractType.LONG_TERM })
    contractType: ContractType;

    @Prop({ required: true })
    startDate: Date;

    @Prop()
    endDate: Date;

    @Prop({ required: true, default: 0 })
    rentPrice: number;

    @Prop({ default: 0 })
    depositAmount: number;

    @Prop({ default: 0 })
    electricityPrice: number;

    @Prop({ default: 0 })
    waterPrice: number;

    // === Pricing Overrides ===
    @Prop({ type: String, enum: RoomType, default: RoomType.LONG_TERM })
    roomType: RoomType;

    @Prop({ type: String, enum: ShortTermPricingType })
    shortTermPricingType: ShortTermPricingType;

    @Prop({ type: String, enum: ['PER_HOUR', 'TABLE'] })
    hourlyPricingMode: string;

    @Prop({ default: 0 })
    pricePerHour: number;

    @Prop({ default: 0 })
    fixedPrice: number;

    @Prop({ type: [ShortTermPriceTierSchema], default: [] })
    shortTermPrices: ShortTermPriceTier[];

    @Prop({
        type: [{
            name: String,
            amount: Number,
            quantity: { type: Number, default: 1 },
            isRecurring: Boolean,
        }],
        default: [],
    })
    serviceCharges: Array<{
        name: string;
        amount: number;
        isRecurring: boolean;
    }>;

    @Prop({ type: String, enum: PaymentCycle, default: PaymentCycle.MONTHLY })
    paymentCycle: PaymentCycle;

    @Prop({ default: 1 })
    paymentCycleMonths: number;

    @Prop({ default: 1 })
    paymentDueDay: number;

    @Prop({ default: 0 })
    initialElectricIndex: number;

    @Prop({ default: 0 })
    initialWaterIndex: number;

    @Prop({ type: String, enum: ContractStatus, default: ContractStatus.ACTIVE })
    status: ContractStatus;

    @Prop({ type: String })
    terms: string;

    @Prop({ trim: true })
    notes: string;

    @Prop({ default: false })
    isDeleted: boolean;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);

ContractSchema.index({ ownerId: 1, isDeleted: 1 });
ContractSchema.index({ roomId: 1, status: 1 });
ContractSchema.index({ tenantId: 1 });
ContractSchema.index({ startDate: 1, endDate: 1 });
