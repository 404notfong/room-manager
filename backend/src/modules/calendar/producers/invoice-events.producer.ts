import { InvoiceStatus } from '@common/constants/enums';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CalendarEventDto, CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';
import { startOfLocalDay, daysBetween } from '../helpers/date-keys';
import { computeSeverity } from '../helpers/severity';

@Injectable()
export class InvoiceEventsProducer {
    constructor(
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    ) {}

    async produce(
        ownerId: string,
        range: { start: Date; end: Date },
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const today = startOfLocalDay(new Date());

        const invoices = await this.invoiceModel
            .find({
                ownerId: new Types.ObjectId(ownerId),
                isDeleted: { $ne: true },
                dueDate: { $gte: range.start, $lte: range.end },
                status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
            })
            .populate({
                path: 'roomId',
                select: 'name roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        const filtered = buildingId
            ? invoices.filter((i: any) => i.roomId?.buildingId?._id?.toString() === buildingId)
            : invoices;

        return (filtered as any[])
            .filter((inv) => (inv.remainingAmount ?? 0) > 0)
            .map((invoice) => {
                const room = invoice.roomId;
                const tenant = invoice.tenantId;
                const dueDate = new Date(invoice.dueDate);
                const days = daysBetween(today, dueDate);
                const isOverdue = days < 0;

                return {
                    _id: `invoice-${invoice._id}`,
                    date: dueDate,
                    type: isOverdue ? CalendarEventType.INVOICE_OVERDUE : CalendarEventType.INVOICE_DUE,
                    severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                    relatedId: invoice._id.toString(),
                    relatedType: 'invoice' as const,
                    roomName: room?.roomName || room?.name,
                    tenantName: tenant?.name,
                    buildingName: room?.buildingId?.name,
                    amount: invoice.remainingAmount,
                    ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                };
            });
    }
}
