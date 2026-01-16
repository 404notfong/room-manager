import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TenantStatus } from '../../../common/constants/enums';

export type TenantDocument = Tenant & Document;

@Schema({ timestamps: true })
export class Tenant {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    ownerId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    fullName: string;

    @Prop({ trim: true, index: true })
    fullNameNormalized: string;

    @Prop({ required: true, unique: true, index: true })
    code: string;

    @Prop({ required: true, trim: true, index: true })
    idCard: string;

    @Prop({ required: true, trim: true, index: true })
    phone: string;

    @Prop({ trim: true })
    email: string;

    @Prop({ trim: true })
    occupation: string;

    @Prop()
    dateOfBirth: Date;

    @Prop({ type: String, enum: ['MALE', 'FEMALE', 'OTHER'] })
    gender: string;

    @Prop({ trim: true })
    permanentAddress: string;

    @Prop({ type: Types.ObjectId, ref: 'Room', index: true })
    currentRoomId: Types.ObjectId;

    @Prop()
    moveInDate: Date;

    @Prop()
    moveOutDate: Date;

    @Prop({ type: String, enum: TenantStatus, default: TenantStatus.ACTIVE })
    status: TenantStatus;

    @Prop({
        type: {
            name: String,
            phone: String,
            relationship: String,
        },
    })
    emergencyContact: {
        name: string;
        phone: string;
        relationship: string;
    };

    @Prop({ trim: true })
    notes: string;

    @Prop({ default: false })
    isDeleted: boolean;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

TenantSchema.index({ ownerId: 1, isDeleted: 1 });
TenantSchema.index({ idCard: 1 });
TenantSchema.index({ phone: 1 });
TenantSchema.index({ currentRoomId: 1, status: 1 });
