import { IsNotEmpty, IsMongoId, IsNumber, IsDate, IsEnum, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '../../../common/constants/enums';

class ServiceChargeDto {
    @IsString()
    name: string;

    @IsNumber()
    amount: number;
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

    @IsNumber()
    @IsNotEmpty()
    month: number;

    @IsNumber()
    @IsNotEmpty()
    year: number;

    @IsNumber()
    @IsOptional()
    previousElectricIndex?: number;

    @IsNumber()
    @IsOptional()
    currentElectricIndex?: number;

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
    waterPrice?: number;

    @IsNumber()
    @IsNotEmpty()
    rentAmount: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceChargeDto)
    @IsOptional()
    serviceCharges?: ServiceChargeDto[];

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    dueDate: Date;

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
}
