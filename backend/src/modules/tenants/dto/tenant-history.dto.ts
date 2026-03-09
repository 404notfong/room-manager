import { PaginationDto } from '@common/dto/pagination.dto';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum HistoryEventType {
    CONTRACT = 'contract',
    INVOICE = 'invoice',
    PAYMENT = 'payment',
}

export class GetTenantHistoryDto extends PaginationDto {
    @IsOptional()
    @IsEnum(HistoryEventType)
    type?: HistoryEventType;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export interface ContractHistoryData {
    contractId: string;
    contractCode: string;
    contractType: string;
    startDate: Date;
    endDate?: Date;
    roomName: string;
    rentPrice: number;
    status: string;
}

export interface InvoiceHistoryData {
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
    billingPeriod: { month: number; year: number };
    dueDate: Date;
}

export interface PaymentHistoryData {
    paymentId: string;
    amount: number;
    paymentMethod: string;
    paymentDate: Date;
    invoiceNumber?: string;
}

export interface TenantHistoryEvent {
    type: HistoryEventType;
    date: Date;
    title: string;
    data: ContractHistoryData | InvoiceHistoryData | PaymentHistoryData;
}
