import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InvoiceStatus } from '../../../common/constants/enums';

export type InvoiceDocument = Invoice & Document;

@Schema({ timestamps: true })
export class Invoice {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    ownerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Contract', required: true, index: true })
    contractId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
    roomId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
    tenantId: Types.ObjectId;

    @Prop({ required: true, unique: true, index: true })
    invoiceNumber: string;

    @Prop({
        type: {
            month: Number,
            year: Number,
        },
        required: true,
    })
    billingPeriod: {
        month: number;
        year: number;
    };

    // Electric
    @Prop({ default: 0 })
    previousElectricIndex: number;

    @Prop({ default: 0 })
    currentElectricIndex: number;

    @Prop({ default: 0 })
    electricityUsed: number;

    @Prop({ default: 0 })
    electricityPrice: number;

    @Prop({ default: 0 })
    electricityAmount: number;

    // Water
    @Prop({ default: 0 })
    previousWaterIndex: number;

    @Prop({ default: 0 })
    currentWaterIndex: number;

    @Prop({ default: 0 })
    waterUsed: number;

    @Prop({ default: 0 })
    waterPrice: number;

    @Prop({ default: 0 })
    waterAmount: number;

    // Charges
    @Prop({ default: 0 })
    rentAmount: number;

    @Prop({
        type: [{
            name: String,
            amount: Number,
        }],
        default: [],
    })
    serviceCharges: Array<{
        name: string;
        amount: number;
    }>;

    // Total
    @Prop({ required: true, default: 0 })
    totalAmount: number;

    @Prop({ default: 0 })
    paidAmount: number;

    @Prop({ default: 0 })
    remainingAmount: number;

    @Prop({ type: String, enum: InvoiceStatus, default: InvoiceStatus.PENDING })
    status: InvoiceStatus;

    @Prop({ required: true })
    dueDate: Date;

    @Prop()
    paidDate: Date;

    @Prop({ trim: true })
    notes: string;

    @Prop({ default: false })
    isDeleted: boolean;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ ownerId: 1, isDeleted: 1 });
InvoiceSchema.index({ contractId: 1 });
InvoiceSchema.index({ roomId: 1 });
InvoiceSchema.index({ tenantId: 1 });
InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ 'billingPeriod.year': 1, 'billingPeriod.month': 1 });
InvoiceSchema.index({ status: 1, dueDate: 1 });
