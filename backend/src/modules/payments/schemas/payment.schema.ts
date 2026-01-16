import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentMethod } from '../../../common/constants/enums';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    ownerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Invoice', required: true, index: true })
    invoiceId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Contract', required: true, index: true })
    contractId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
    tenantId: Types.ObjectId;

    @Prop({ required: true, default: 0 })
    amount: number;

    @Prop({ type: String, enum: PaymentMethod, default: PaymentMethod.CASH })
    paymentMethod: PaymentMethod;

    @Prop({ required: true })
    paymentDate: Date;

    @Prop({ trim: true })
    transactionId: string;

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    receivedBy: Types.ObjectId;

    @Prop({ default: false })
    isDeleted: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ ownerId: 1, isDeleted: 1 });
PaymentSchema.index({ invoiceId: 1 });
PaymentSchema.index({ contractId: 1 });
PaymentSchema.index({ tenantId: 1 });
PaymentSchema.index({ paymentDate: 1 });
