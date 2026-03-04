import { ContractStatus, ContractType, RoomType } from '@common/constants/enums';
import { Contract, ContractDocument } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    CalendarDayEventsDto,
    CalendarEventDto,
    CalendarEventSeverity,
    CalendarEventType,
    CalendarMonthSummaryDto,
} from './dto/calendar-event.dto';

/** Convert a Date to 'YYYY-MM-DD' in local timezone (avoids UTC shift from toISOString) */
function toLocalDateKey(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

@Injectable()
export class CalendarService {
    constructor(
        @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    ) { }

    /**
     * Get all calendar events within a date range
     */
    async getEventsInRange(
        ownerId: string,
        startDate: Date,
        endDate: Date,
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const events: CalendarEventDto[] = [];

        // Get contract events (check-in / checkout)
        const contractEvents = await this.getContractEvents(ownerId, startDate, endDate, buildingId);
        events.push(...contractEvents);

        // Get payment due events (long-term recurring payments)
        const paymentEvents = await this.getPaymentDueEvents(ownerId, startDate, endDate, buildingId);
        events.push(...paymentEvents);

        // Get invoice events
        const invoiceEvents = await this.getInvoiceEvents(ownerId, startDate, endDate, buildingId);
        events.push(...invoiceEvents);

        // Sort by date
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return events;
    }

    /**
     * Get events for contract start/end dates
     * - DRAFT contracts: Check-in events based on startDate
     * - ACTIVE contracts: Checkout events based on endDate
     */
    private async getContractEvents(
        ownerId: string,
        startDate: Date,
        endDate: Date,
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const events: CalendarEventDto[] = [];
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        // Build query - include DRAFT (deposit) and ACTIVE contracts
        const query: any = {
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: { $ne: true },
            status: { $in: [ContractStatus.ACTIVE, ContractStatus.DRAFT] },
            $or: [
                // Contract starts within range (for DRAFT check-in events)
                { startDate: { $gte: startDate, $lte: endDate } },
                // Contract ends within range (for ACTIVE checkout events)
                { endDate: { $gte: startDate, $lte: endDate } },
                // DRAFT contracts with startDate before range but not yet activated (overdue check-in)
                { status: ContractStatus.DRAFT, startDate: { $lt: today } },
            ],
        };

        const contracts = await this.contractModel
            .find(query)
            .populate({
                path: 'roomId',
                select: 'roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        // Filter by building if specified
        const filteredContracts = buildingId
            ? contracts.filter((c: any) => c.roomId?.buildingId?._id?.toString() === buildingId)
            : contracts;

        for (const contract of filteredContracts) {
            const room = contract.roomId as any;
            const tenant = contract.tenantId as any;
            const roomName = room?.roomName || room?.name || 'N/A';
            const tenantName = tenant?.name || 'N/A';
            const buildingName = room?.buildingId?.name || 'N/A';

            // DRAFT contracts (Deposit period) - Check-in events
            if (contract.status === ContractStatus.DRAFT && contract.startDate) {
                const startDateObj = new Date(contract.startDate);
                const isShortTerm = contract.contractType === ContractType.SHORT_TERM ||
                    contract.roomType === RoomType.SHORT_TERM;

                // For short-term: compare with full timestamp (hours/minutes)
                // For long-term: compare with day-level precision
                let isOverdue: boolean;
                let daysUntilStart: number;

                if (isShortTerm) {
                    isOverdue = startDateObj.getTime() < now.getTime();
                    daysUntilStart = isOverdue
                        ? -Math.ceil((now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
                        : Math.ceil((startDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                } else {
                    const startDay = new Date(startDateObj);
                    startDay.setHours(0, 0, 0, 0);
                    daysUntilStart = Math.ceil((startDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    isOverdue = daysUntilStart < 0;
                }

                // Overdue check-in (startDate has passed but still DRAFT)
                if (isOverdue) {
                    const daysOverdue = Math.abs(daysUntilStart);
                    events.push({
                        _id: `deposit-checkin-overdue-${contract._id}`,
                        date: startDateObj,
                        type: CalendarEventType.DEPOSIT_CHECKIN_OVERDUE,
                        title: `Quá hạn check-in - ${roomName}`,
                        description: `Quá ${daysOverdue} ngày - ${tenantName}`,
                        severity: CalendarEventSeverity.DANGER,
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        roomName,
                        tenantName,
                        buildingName,
                    });
                }
                // Upcoming check-in (within 7 days)
                else if (daysUntilStart >= 0 && daysUntilStart <= 7 && startDateObj >= startDate && startDateObj <= endDate) {
                    events.push({
                        _id: `deposit-checkin-due-${contract._id}`,
                        date: startDateObj,
                        type: CalendarEventType.DEPOSIT_CHECKIN_DUE,
                        title: `Sắp check-in - ${roomName}`,
                        description: daysUntilStart === 0 ? `Hôm nay - ${tenantName}` : `Còn ${daysUntilStart} ngày - ${tenantName}`,
                        severity: CalendarEventSeverity.WARNING,
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        roomName,
                        tenantName,
                        buildingName,
                    });
                }
                // Normal contract start event (for calendar display)
                else if (startDateObj >= startDate && startDateObj <= endDate) {
                    events.push({
                        _id: `contract-start-${contract._id}`,
                        date: startDateObj,
                        type: CalendarEventType.CONTRACT_START,
                        title: `Hợp đồng bắt đầu - ${roomName}`,
                        description: `Khách: ${tenantName}`,
                        severity: CalendarEventSeverity.INFO,
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        roomName,
                        tenantName,
                        buildingName,
                    });
                }
            }

            // ACTIVE contracts - Checkout events based on endDate
            if (contract.status === ContractStatus.ACTIVE && contract.endDate) {
                const endDateObj = new Date(contract.endDate);
                const isShortTermContract = contract.contractType === ContractType.SHORT_TERM ||
                    contract.roomType === RoomType.SHORT_TERM;

                // For short-term: compare with full timestamp (hours/minutes)
                // For long-term: compare with day-level precision
                let isCheckoutOverdue: boolean;
                let daysUntilEnd: number;

                if (isShortTermContract) {
                    isCheckoutOverdue = endDateObj.getTime() < now.getTime();
                    daysUntilEnd = isCheckoutOverdue
                        ? -Math.ceil((now.getTime() - endDateObj.getTime()) / (1000 * 60 * 60 * 24))
                        : Math.ceil((endDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                } else {
                    const endDay = new Date(endDateObj);
                    endDay.setHours(0, 0, 0, 0);
                    daysUntilEnd = Math.ceil((endDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    isCheckoutOverdue = daysUntilEnd < 0;
                }

                // Overdue checkout (endDate has passed but still ACTIVE)
                if (isCheckoutOverdue) {
                    const daysOverdue = Math.abs(daysUntilEnd);
                    events.push({
                        _id: `active-checkout-overdue-${contract._id}`,
                        date: endDateObj,
                        type: CalendarEventType.ACTIVE_CHECKOUT_OVERDUE,
                        title: `Quá hạn checkout - ${roomName}`,
                        description: `Quá ${daysOverdue} ngày - ${tenantName}`,
                        severity: CalendarEventSeverity.DANGER,
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        roomName,
                        tenantName,
                        buildingName,
                    });
                }
                // Upcoming checkout (within 7 days)
                else if (daysUntilEnd >= 0 && daysUntilEnd <= 7 && endDateObj >= startDate && endDateObj <= endDate) {
                    events.push({
                        _id: `active-checkout-due-${contract._id}`,
                        date: endDateObj,
                        type: CalendarEventType.ACTIVE_CHECKOUT_DUE,
                        title: `Sắp checkout - ${roomName}`,
                        description: daysUntilEnd === 0 ? `Hôm nay - ${tenantName}` : `Còn ${daysUntilEnd} ngày - ${tenantName}`,
                        severity: CalendarEventSeverity.WARNING,
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        roomName,
                        tenantName,
                        buildingName,
                    });
                }
                // Normal contract end event (for calendar display)
                else if (endDateObj >= startDate && endDateObj <= endDate) {
                    events.push({
                        _id: `contract-end-${contract._id}`,
                        date: endDateObj,
                        type: CalendarEventType.CONTRACT_END,
                        title: `Hợp đồng kết thúc - ${roomName}`,
                        description: `Khách: ${tenantName}`,
                        severity: CalendarEventSeverity.INFO,
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        roomName,
                        tenantName,
                        buildingName,
                    });
                }
            }
        }

        return events;
    }

    /**
     * Get payment due events for ACTIVE long-term contracts
     * Calculates recurring payment dates based on paymentCycleMonths + paymentDueDay
     */
    private async getPaymentDueEvents(
        ownerId: string,
        rangeStart: Date,
        rangeEnd: Date,
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const events: CalendarEventDto[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Query ACTIVE long-term contracts
        const query: any = {
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: { $ne: true },
            status: ContractStatus.ACTIVE,
            $or: [
                { contractType: ContractType.LONG_TERM },
                { roomType: RoomType.LONG_TERM },
            ],
        };

        const contracts = await this.contractModel
            .find(query)
            .populate({
                path: 'roomId',
                select: 'roomName buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        // Filter by building if specified
        const filteredContracts = buildingId
            ? contracts.filter((c: any) => c.roomId?.buildingId?._id?.toString() === buildingId)
            : contracts;

        for (const contract of filteredContracts) {
            const room = contract.roomId as any;
            const tenant = contract.tenantId as any;
            const roomName = room?.roomName || room?.name || 'N/A';
            const tenantName = tenant?.name || 'N/A';
            const buildingName = room?.buildingId?.name || 'N/A';

            const cycleMonths = contract.paymentCycleMonths || 1;
            const payDay = contract.paymentDueDay || 1;
            const contractStart = new Date(contract.startDate);

            // Generate payment dates within the calendar range
            // First payment must be >= 1 full cycle after contract start
            const minFirstPaymentMonth = new Date(contractStart.getFullYear(), contractStart.getMonth() + cycleMonths, 1);

            // Start from minFirstPaymentMonth, find first payDay
            const current = new Date(minFirstPaymentMonth.getFullYear(), minFirstPaymentMonth.getMonth(), 1);

            // Check if payDay in this month is before the minimum first payment threshold
            {
                const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
                const clampedDay = Math.min(payDay, lastDay);
                const candidateDate = new Date(current.getFullYear(), current.getMonth(), clampedDay);
                if (candidateDate < minFirstPaymentMonth) {
                    current.setMonth(current.getMonth() + cycleMonths);
                }
            }

            // Safety limit to prevent infinite loop
            const maxIterations = 120; // 10 years of monthly payments
            let iterations = 0;

            while (current <= rangeEnd && iterations < maxIterations) {
                iterations++;

                // Calculate the payment date for this cycle
                const year = current.getFullYear();
                const month = current.getMonth();
                const lastDay = new Date(year, month + 1, 0).getDate();
                const clampedDay = Math.min(payDay, lastDay);
                const paymentDate = new Date(year, month, clampedDay);

                // Only include if within the calendar range
                if (paymentDate >= rangeStart && paymentDate <= rangeEnd) {
                    const paymentDateDay = new Date(paymentDate);
                    paymentDateDay.setHours(0, 0, 0, 0);
                    const isOverdue = paymentDateDay < today;

                    events.push({
                        _id: `payment-${contract._id}-${toLocalDateKey(paymentDate)}`,
                        date: paymentDate,
                        type: isOverdue ? CalendarEventType.PAYMENT_DUE_OVERDUE : CalendarEventType.PAYMENT_DUE,
                        title: isOverdue
                            ? `Quá hạn thanh toán - ${roomName}`
                            : `Nhắc thanh toán - ${roomName}`,
                        description: `${tenantName} - ${contract.rentPrice?.toLocaleString('vi-VN')} VND`,
                        severity: isOverdue ? CalendarEventSeverity.DANGER : CalendarEventSeverity.WARNING,
                        relatedId: contract._id.toString(),
                        relatedType: 'contract',
                        roomName,
                        tenantName,
                        buildingName,
                        amount: contract.rentPrice,
                    });
                }

                // Advance to next cycle
                current.setMonth(current.getMonth() + cycleMonths);
            }
        }

        return events;
    }

    /**
     * Get events for invoice due dates
     */
    private async getInvoiceEvents(
        ownerId: string,
        startDate: Date,
        endDate: Date,
        buildingId?: string,
    ): Promise<CalendarEventDto[]> {
        const events: CalendarEventDto[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build query
        const query: any = {
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: { $ne: true },
            dueDate: { $gte: startDate, $lte: endDate },
            status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        };

        const invoices = await this.invoiceModel
            .find(query)
            .populate({
                path: 'roomId',
                select: 'name buildingId',
                populate: { path: 'buildingId', select: 'name' },
            })
            .populate('tenantId', 'name phone')
            .lean();

        // Filter by building if specified
        const filteredInvoices = buildingId
            ? invoices.filter((inv: any) => inv.roomId?.buildingId?._id?.toString() === buildingId)
            : invoices;

        for (const invoice of filteredInvoices) {
            const room = invoice.roomId as any;
            const tenant = invoice.tenantId as any;
            const roomName = room?.name || 'N/A';
            const tenantName = tenant?.name || 'N/A';
            const buildingName = room?.buildingId?.name || 'N/A';

            const dueDate = new Date(invoice.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const isOverdue = dueDate < today && invoice.remainingAmount > 0;

            events.push({
                _id: `invoice-${invoice._id}`,
                date: invoice.dueDate,
                type: isOverdue ? CalendarEventType.INVOICE_OVERDUE : CalendarEventType.INVOICE_DUE,
                title: isOverdue
                    ? `Hóa đơn quá hạn - ${roomName}`
                    : `Hóa đơn đến hạn - ${roomName}`,
                description: `${tenantName} - ${invoice.remainingAmount?.toLocaleString('vi-VN')} VND`,
                severity: isOverdue ? CalendarEventSeverity.DANGER : CalendarEventSeverity.WARNING,
                relatedId: invoice._id.toString(),
                relatedType: 'invoice',
                roomName,
                tenantName,
                buildingName,
                amount: invoice.remainingAmount,
            });
        }

        return events;
    }

    /**
     * Get events grouped by day
     */
    async getEventsByDay(
        ownerId: string,
        date: Date,
        buildingId?: string,
    ): Promise<CalendarDayEventsDto> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const events = await this.getEventsInRange(ownerId, startOfDay, endOfDay, buildingId);

        return {
            date: toLocalDateKey(date),
            events,
        };
    }

    /**
     * Get monthly summary (event counts per day)
     */
    async getMonthSummary(
        ownerId: string,
        year: number,
        month: number,
        buildingId?: string,
    ): Promise<CalendarMonthSummaryDto> {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const events = await this.getEventsInRange(ownerId, startDate, endDate, buildingId);

        const days: Record<string, Record<CalendarEventType, number>> = {};

        for (const event of events) {
            const dateKey = toLocalDateKey(new Date(event.date));

            if (!days[dateKey]) {
                days[dateKey] = {
                    [CalendarEventType.CONTRACT_START]: 0,
                    [CalendarEventType.CONTRACT_END]: 0,
                    [CalendarEventType.DEPOSIT_CHECKIN_DUE]: 0,
                    [CalendarEventType.DEPOSIT_CHECKIN_OVERDUE]: 0,
                    [CalendarEventType.ACTIVE_CHECKOUT_DUE]: 0,
                    [CalendarEventType.ACTIVE_CHECKOUT_OVERDUE]: 0,
                    [CalendarEventType.INVOICE_DUE]: 0,
                    [CalendarEventType.INVOICE_OVERDUE]: 0,
                    [CalendarEventType.PAYMENT_DUE]: 0,
                    [CalendarEventType.PAYMENT_DUE_OVERDUE]: 0,
                };
            }

            days[dateKey][event.type]++;
        }

        return {
            days,
            totalEvents: events.length,
        };
    }
}
