import { InvoiceStatus, InvoiceType } from '@common/constants/enums';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class ServiceChargeDto {
    @IsString()
    name: string;

    @IsNumber()
    amount: number;

    @IsNumber()
    @IsOptional()
    quantity?: number;

    @IsBoolean()
    @IsOptional()
    isRecurring?: boolean;

    @IsString()
    @IsOptional()
    _id?: string;
}

class AdjustmentDto {
    @IsString()
    @IsNotEmpty()
    description: string;

    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @IsBoolean()
    @IsOptional()
    isDiscount?: boolean;  // true = giảm giá, false = phát sinh
}

export class CreateInvoiceDto {
    @IsMongoId()
    @IsNotEmpty()
    contractId: string;

    @IsMongoId()
    @IsNotEmpty()
    roomId: string;

    @IsMongoId()
    @IsNotEmpty()
    tenantId: string;

    // Invoice type
    @IsEnum(InvoiceType)
    @IsOptional()
    invoiceType?: InvoiceType;

    @IsNumber()
    @IsNotEmpty()
    month: number;

    @IsNumber()
    @IsNotEmpty()
    year: number;

    // === Short-term specific fields ===
    @IsDate()
    @Type(() => Date)
    @IsOptional()
    checkInTime?: Date;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    checkOutTime?: Date;

    @IsNumber()
    @IsOptional()
    totalHours?: number;

    @IsNumber()
    @IsOptional()
    totalDays?: number;

    // === Electric/Water (Long-term) ===
    @IsNumber()
    @IsOptional()
    previousElectricIndex?: number;

    @IsNumber()
    @IsOptional()
    currentElectricIndex?: number;

    @IsNumber()
    @IsOptional()
    initialElectricIndex?: number;

    @IsNumber()
    @IsOptional()
    electricityPrice?: number;

    @IsNumber()
    @IsOptional()
    previousWaterIndex?: number;

    @IsNumber()
    @IsOptional()
    currentWaterIndex?: number;

    @IsNumber()
    @IsOptional()
    initialWaterIndex?: number;

    @IsNumber()
    @IsOptional()
    waterPrice?: number;

    // === Charges ===
    @IsNumber()
    @IsOptional()
    billingMonths?: number;

    @IsNumber()
    @IsNotEmpty()
    rentAmount: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceChargeDto)
    @IsOptional()
    serviceCharges?: ServiceChargeDto[];

    // === Adjustments (additional charges / discounts) ===
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdjustmentDto)
    @IsOptional()
    adjustments?: AdjustmentDto[];

    // === Contract Snapshot ===
    @IsOptional()
    contractSnapshot?: Record<string, any>;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    dueDate: Date;

    @IsBoolean()
    @IsOptional()
    applyDeposit?: boolean;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateInvoiceDto {
    @IsEnum(InvoiceStatus)
    @IsOptional()
    status?: InvoiceStatus;

    @IsNumber()
    @IsOptional()
    paidAmount?: number;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    paidDate?: Date;

    @IsString()
    @IsOptional()
    notes?: string;

    // Allow updating adjustments
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdjustmentDto)
    @IsOptional()
    adjustments?: AdjustmentDto[];
}
