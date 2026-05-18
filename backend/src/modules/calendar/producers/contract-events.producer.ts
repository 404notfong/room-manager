import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContractStatus } from '@common/constants/enums';
import { CalendarEventDto, CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';
import { startOfLocalDay, daysBetween } from '../helpers/date-keys';
import { computeSeverity } from '../helpers/severity';

@Injectable()
export class ContractEventsProducer {
    constructor(
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
    ) {}

    async produce(
        ownerId: string,
        range: { start: Date; end: Date },
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const today = startOfLocalDay(new Date());

        const contracts = await this.contractModel
            .find({
                ownerId: new Types.ObjectId(ownerId),
                isDeleted: { $ne: true },
                status: { $in: [ContractStatus.ACTIVE, ContractStatus.DRAFT] },
                $or: [
                    { startDate: { $gte: range.start, $lte: range.end } },
                    { endDate: { $gte: range.start, $lte: range.end } },
                ],
            })
            .populate({
                path: 'roomId',
                select: 'roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        const filtered = buildingId
            ? contracts.filter((c: any) => c.roomId?.buildingId?._id?.toString() === buildingId)
            : contracts;

        const events: CalendarEventDto[] = [];

        for (const contract of filtered as any[]) {
            const room = contract.roomId;
            const tenant = contract.tenantId;
            const meta = {
                roomName: room?.roomName,
                tenantName: tenant?.name,
                buildingName: room?.buildingId?.name,
            };

            if (contract.status === ContractStatus.DRAFT && contract.startDate) {
                const startDate = new Date(contract.startDate);
                if (startDate >= range.start && startDate <= range.end) {
                    const days = daysBetween(today, startDate);
                    const isOverdue = days < 0;
                    events.push({
                        _id: isOverdue
                            ? `deposit-checkin-overdue-${contract._id}`
                            : `deposit-checkin-due-${contract._id}`,
                        date: startDate,
                        type: isOverdue
                            ? CalendarEventType.DEPOSIT_CHECKIN_OVERDUE
                            : CalendarEventType.DEPOSIT_CHECKIN_DUE,
                        severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                        ...meta,
                    });
                }
            }

            if (contract.status === ContractStatus.ACTIVE && contract.endDate) {
                const endDate = new Date(contract.endDate);
                if (endDate >= range.start && endDate <= range.end) {
                    const days = daysBetween(today, endDate);
                    const isOverdue = days < 0;
                    events.push({
                        _id: isOverdue
                            ? `active-checkout-overdue-${contract._id}`
                            : `active-checkout-due-${contract._id}`,
                        date: endDate,
                        type: isOverdue
                            ? CalendarEventType.ACTIVE_CHECKOUT_OVERDUE
                            : CalendarEventType.ACTIVE_CHECKOUT_DUE,
                        severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                        ...meta,
                    });
                }
            }
        }

        return events;
    }
}
