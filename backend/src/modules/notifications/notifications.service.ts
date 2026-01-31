import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    ) { }

    async create(
        userId: string,
        title: string,
        message: string,
        type: NotificationType = NotificationType.SYSTEM,
        metadata: Record<string, any> = {},
    ): Promise<Notification> {
        return this.notificationModel.create({
            userId: new Types.ObjectId(userId),
            title,
            message,
            type,
            metadata,
        });
    }

    async findAll(userId: string, page = 1, limit = 10): Promise<{ notifications: Notification[]; total: number; page: number; totalPages: number }> {
        const skip = (page - 1) * limit;
        const total = await this.notificationModel.countDocuments({ userId: new Types.ObjectId(userId) });

        const notifications = await this.notificationModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();

        return {
            notifications: notifications as Notification[],
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async countUnread(userId: string): Promise<number> {
        return this.notificationModel.countDocuments({
            userId: new Types.ObjectId(userId),
            isRead: false,
        });
    }

    async markAsRead(id: string, userId: string): Promise<Notification | null> {
        return this.notificationModel.findOneAndUpdate(
            { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
            { isRead: true },
            { new: true },
        ).exec();
    }

    async markAllAsRead(userId: string): Promise<void> {
        await this.notificationModel.updateMany(
            { userId: new Types.ObjectId(userId), isRead: false },
            { isRead: true },
        ).exec();
    }
}
