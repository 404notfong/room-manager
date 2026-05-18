import { IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';

export enum CalendarEventType {
    CONTRACT_START = 'CONTRACT_START',
    CONTRACT_END = 'CONTRACT_END',
    
    // Deposit contract events
    DEPOSIT_CHECKIN_DUE = 'DEPOSIT_CHECKIN_DUE',           // Cọc - sắp đến ngày check-in
    DEPOSIT_CHECKIN_OVERDUE = 'DEPOSIT_CHECKIN_OVERDUE',  // Cọc - quá hạn check-in
    
    // Active contract events  
    ACTIVE_CHECKOUT_DUE = 'ACTIVE_CHECKOUT_DUE',          // Active - sắp checkout
    ACTIVE_CHECKOUT_OVERDUE = 'ACTIVE_CHECKOUT_OVERDUE',  // Active - quá hạn checkout
    
    INVOICE_DUE = 'INVOICE_DUE',
    INVOICE_OVERDUE = 'INVOICE_OVERDUE',
    PAYMENT_DUE = 'PAYMENT_DUE',
    PAYMENT_DUE_OVERDUE = 'PAYMENT_DUE_OVERDUE',       // Long-term - quá hạn thanh toán
}

export enum CalendarEventSeverity {
    INFO = 'info',
    WARNING = 'warning',
    DANGER = 'danger',
}

export class CalendarEventDto {
    _id: string;
    date: Date;
    type: CalendarEventType;
    title?: string;
    description?: string;
    severity: CalendarEventSeverity;
    relatedId: string;
    relatedType: 'contract' | 'invoice';
    roomName?: string;
    tenantName?: string;
    buildingName?: string;
    amount?: number;
    daysOverdue?: number;
}

export class GetCalendarEventsDto {
    @IsDateString()
    start: string;

    @IsDateString()
    end: string;

    @IsOptional()
    @IsMongoId()
    buildingId?: string;

    @IsOptional()
    @IsEnum(CalendarEventType)
    type?: CalendarEventType;
}

export class CalendarDayEventsDto {
    date: string;
    events: CalendarEventDto[];
}

export class CalendarMonthSummaryDto {
    days: Record<string, Record<CalendarEventType, number>>;
    totalEvents: number;
}
