import { IsNotEmpty, IsMongoId, IsEnum, IsDate, IsDateString, IsNumber, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ContractType, ContractStatus, PaymentCycle, RoomType, ShortTermPricingType } from '../../../common/constants/enums';
import { CreateTenantDto } from '../../tenants/dto/tenant.dto';

class ServiceChargeDto {
    @IsString()
    name: string;

    @IsNumber()
    amount: number;

    @IsNumber()
    @IsOptional()
    quantity?: number;

    @IsOptional()
    isRecurring?: boolean;

    @IsMongoId()
    @IsOptional()
    serviceId?: string;

    @IsOptional()
    isPredefined?: boolean;
}

class ShortTermPriceTierDto {
    @IsNumber()
    fromValue: number;

    @IsNumber()
    toValue: number;

    @IsNumber()
    price: number;
}

export class CreateContractDto {
    @IsMongoId()
    @IsNotEmpty()
    roomId: string;

    @IsMongoId()
    @IsOptional()
    buildingId?: string;

    @IsMongoId()
    @IsOptional()
    tenantId?: string;

    @ValidateNested()
    @Type(() => CreateTenantDto)
    @IsOptional()
    newTenant?: CreateTenantDto;

    @IsEnum(ContractType)
    @IsOptional()
    contractType?: ContractType;

    // === Pricing Overrides ===
    @IsEnum(RoomType)
    @IsOptional()
    roomType?: RoomType;

    @IsEnum(ShortTermPricingType)
    @IsOptional()
    shortTermPricingType?: ShortTermPricingType;

    @IsString()
    @IsOptional()
    hourlyPricingMode?: string;

    @IsNumber()
    @IsOptional()
    pricePerHour?: number;

    @IsNumber()
    @IsOptional()
    fixedPrice?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ShortTermPriceTierDto)
    @IsOptional()
    shortTermPrices?: ShortTermPriceTierDto[];

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    startDate: Date;

    @IsDate()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return undefined;
        return new Date(value);
    })
    endDate?: any;

    @IsNumber()
    rentPrice: number;

    @IsNumber()
    @IsOptional()
    depositAmount?: number;

    @IsNumber()
    @IsOptional()
    electricityPrice?: number;

    @IsNumber()
    @IsOptional()
    waterPrice?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceChargeDto)
    @IsOptional()
    serviceCharges?: ServiceChargeDto[];

    @IsEnum(PaymentCycle)
    @IsOptional()
    paymentCycle?: PaymentCycle;

    @IsNumber()
    @IsOptional()
    paymentCycleMonths?: number;

    @IsNumber()
    @IsOptional()
    paymentDueDay?: number;

    @IsNumber()
    @IsOptional()
    initialElectricIndex?: number;

    @IsNumber()
    @IsOptional()
    initialWaterIndex?: number;

    @IsString()
    @IsOptional()
    terms?: string;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsEnum(ContractStatus)
    @IsOptional()
    status?: ContractStatus;
}

export class UpdateContractDto {
    @IsEnum(ContractType)
    @IsOptional()
    contractType?: ContractType;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return undefined;
        return new Date(value);
    })
    endDate?: any;

    @IsNumber()
    @IsOptional()
    rentPrice?: number;

    @IsNumber()
    @IsOptional()
    depositAmount?: number;

    @IsNumber()
    @IsOptional()
    electricityPrice?: number;

    @IsNumber()
    @IsOptional()
    waterPrice?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceChargeDto)
    @IsOptional()
    serviceCharges?: ServiceChargeDto[];

    @IsEnum(PaymentCycle)
    @IsOptional()
    paymentCycle?: PaymentCycle;

    @IsNumber()
    @IsOptional()
    paymentCycleMonths?: number;

    @IsNumber()
    @IsOptional()
    paymentDueDay?: number;

    @IsEnum(ContractStatus)
    @IsOptional()
    status?: ContractStatus;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsString()
    @IsOptional()
    terms?: string;
}

export class GetContractsDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsMongoId()
    buildingId?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    page?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    limit?: number;
}

export class ActivateContractDto {
    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    startDate: Date;

    @IsDate()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return undefined;
        return new Date(value);
    })
    endDate?: any;
}
