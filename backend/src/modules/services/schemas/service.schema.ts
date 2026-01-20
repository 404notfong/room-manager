import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ServiceDocument = Service & Document;

// Sub-schema for price tiers
@Schema({ _id: false })
export class ServicePriceTier {
    @Prop({ required: true })
    fromValue: number;

    @Prop({ required: true })
    toValue: number;

    @Prop({ required: true })
    price: number;
}

export const ServicePriceTierSchema = SchemaFactory.createForClass(ServicePriceTier);

@Schema({ timestamps: true })
export class Service {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    ownerId: Types.ObjectId;

    @Prop({ required: true, trim: true, unique: true, index: true })
    code: string;

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ trim: true, index: true })
    nameNormalized: string;

    @Prop({ required: true, trim: true })
    unit: string;

    @Prop({ type: String, enum: ['FIXED', 'TABLE'], default: 'FIXED' })
    priceType: string;

    @Prop({ default: 0 })
    fixedPrice: number;

    @Prop({ type: [ServicePriceTierSchema], default: [] })
    priceTiers: ServicePriceTier[];

    @Prop({ type: String, enum: ['ALL', 'SPECIFIC'], default: 'ALL' })
    buildingScope: string;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Building' }], default: [] })
    buildingIds: Types.ObjectId[];

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    isDeleted: boolean;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

ServiceSchema.index({ ownerId: 1, isDeleted: 1, isActive: 1 });
ServiceSchema.index({ code: 1 });
ServiceSchema.index({ buildingIds: 1 });
