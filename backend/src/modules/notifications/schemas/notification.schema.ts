import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
    SYSTEM = 'SYSTEM',
    INVOICE = 'INVOICE',
    CONTRACT = 'CONTRACT',
    PAYMENT = 'PAYMENT',
    SERVICE = 'SERVICE'
}

@Schema({ timestamps: true })
export class Notification {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
    userId: MongooseSchema.Types.ObjectId;

    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    message: string;

    @Prop({ type: String, enum: NotificationType, default: NotificationType.SYSTEM })
    type: NotificationType;

    @Prop({ default: false })
    isRead: boolean;

    @Prop({ type: Object, default: {} })
    metadata: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index for fetching user's notifications sorted by time
NotificationSchema.index({ userId: 1, createdAt: -1 });
