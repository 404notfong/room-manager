import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { ContractStatus, ContractType, RoomType } from '@common/constants/enums';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CalendarEventDto, CalendarEventType, CalendarEventSeverity } from '../dto/calendar-event.dto';
import { startOfLocalDay, daysBetween } from '../helpers/date-keys';
import { computeSeverity } from '../helpers/severity';

@Injectable()
export class PaymentDueProducer {
    constructor(
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
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
                status: ContractStatus.ACTIVE,
                $or: [
                    { contractType: ContractType.LONG_TERM },
                    { roomType: RoomType.LONG_TERM },
                ],
            })
            .populate({
                path: 'roomId',
                select: 'roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        const filteredContracts = buildingId
            ? contracts.filter((c: any) => c.roomId?.buildingId?._id?.toString() === buildingId)
            : contracts;

        if (filteredContracts.length === 0) return [];

        const contractIds = filteredContracts.map((c: any) => c._id);
        const existingInvoices = await this.invoiceModel
            .find({
                contractId: { $in: contractIds },
                isDeleted: { $ne: true },
            })
            .select('contractId billingPeriod')
            .lean();

        const invoiceKeys = new Set<string>();
        for (const inv of existingInvoices as any[]) {
            invoiceKeys.add(`${inv.contractId}:${inv.billingPeriod.year}:${inv.billingPeriod.month}`);
        }

        const events: CalendarEventDto[] = [];

        // Iteration builds payment dates in local time, but range.end is
        // typically supplied in UTC (e.g. 'YYYY-12-31T23:59:59Z'). In eastern
        // timezones that UTC instant resolves to the following day locally, so
        // we anchor the loop boundary to the UTC calendar-date of range.end
        // expressed at end-of-day local time. This keeps a December range
        // from leaking a stray January payment.
        const rangeEndLocal = new Date(
            range.end.getUTCFullYear(),
            range.end.getUTCMonth(),
            range.end.getUTCDate(),
            23, 59, 59, 999,
        );

        // Symmetric to rangeEndLocal: anchor lower bound at the UTC calendar date
        // of range.start, expressed at local start-of-day. Prevents day-1 payments
        // from being silently dropped when range.start arrives as 'YYYY-MM-DDT00:00:00Z'
        // in a positive-offset timezone.
        const rangeStartLocal = new Date(
            range.start.getUTCFullYear(),
            range.start.getUTCMonth(),
            range.start.getUTCDate(),
            0, 0, 0, 0,
        );

        for (const contract of filteredContracts as any[]) {
            const room = contract.roomId;
            const tenant = contract.tenantId;
            const cycleMonths = contract.paymentCycleMonths || 1;
            const rawPayDay = contract.paymentDueDay || 1;
            const payDay = Math.max(1, Math.min(31, rawPayDay));
            const contractStart = new Date(contract.startDate);

            const firstYear = contractStart.getFullYear();
            const firstMonth = contractStart.getMonth() + cycleMonths;
            const cursor = new Date(firstYear, firstMonth, 1);

            // Cap iterations defensively at (range span in months / cycleMonths) + 12 slack.
            const rangeSpanMonths = (rangeEndLocal.getFullYear() - cursor.getFullYear()) * 12
                + (rangeEndLocal.getMonth() - cursor.getMonth()) + 1;
            const maxIterations = Math.max(12, Math.ceil(rangeSpanMonths / cycleMonths) + 12);
            let i = 0;

            while (cursor <= rangeEndLocal && i < maxIterations) {
                i++;
                const year = cursor.getFullYear();
                const month = cursor.getMonth();
                const lastDay = new Date(year, month + 1, 0).getDate();
                const clampedDay = Math.min(payDay, lastDay);
                const paymentDate = new Date(year, month, clampedDay);

                if (paymentDate >= rangeStartLocal && paymentDate <= rangeEndLocal) {
                    const billingMonth = month + 1;
                    const key = `${contract._id}:${year}:${billingMonth}`;
                    const invoiceExists = invoiceKeys.has(key);

                    if (!invoiceExists) {
                        const days = daysBetween(today, paymentDate);
                        const isOverdue = days < 0;
                        events.push({
                            _id: `payment-${contract._id}-${year}-${billingMonth}`,
                            date: paymentDate,
                            type: isOverdue ? CalendarEventType.PAYMENT_DUE_OVERDUE : CalendarEventType.PAYMENT_DUE,
                            severity: isOverdue ? CalendarEventSeverity.DANGER : computeSeverity(days),
                            relatedId: contract._id.toString(),
                            relatedType: 'contract',
                            roomName: room?.roomName,
                            tenantName: tenant?.name,
                            buildingName: room?.buildingId?.name,
                            amount: contract.rentPrice,
                            ...(isOverdue ? { daysOverdue: Math.abs(days) } : {}),
                        });
                    }
                }

                cursor.setMonth(cursor.getMonth() + cycleMonths);
            }
        }

        return events;
    }
}
