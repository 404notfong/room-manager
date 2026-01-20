import { IsNotEmpty, IsMongoId, IsEnum, IsDate, IsDateString, IsNumber, IsArray, IsOptional, IsString, ValidateNested, IsBoolean, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ContractType, ContractStatus, PaymentCycle, RoomType, ShortTermPricingType } from '@common/constants/enums';
import { CreateTenantDto } from '@modules/tenants/dto/tenant.dto';

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

    @IsMongoId()
    @IsOptional()
    serviceId?: string;

    @IsBoolean()
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
    @IsNotEmpty()
    buildingId: string;

    @IsMongoId()
    @IsOptional()
    tenantId?: string;

    @ValidateNested()
    @Type(() => CreateTenantDto)
    @IsOptional()
    newTenant?: CreateTenantDto;

    @IsEnum(ContractType)
    @IsNotEmpty()
    contractType: ContractType;

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

    @Type(() => Date)
    @IsNotEmpty()
    @IsDate()
    startDate: Date;

    @Type(() => Date)
    @IsOptional()
    @IsDate()
    endDate?: Date | undefined;

    @IsNumber()
    rentPrice: number;

    @IsNumber()
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

    @IsEnum(RoomType)
    @IsOptional()
    roomType?: RoomType;

    @Type(() => Date)
    @IsOptional()
    @IsDate()
    startDate?: Date;

    @Type(() => Date)
    @IsOptional()
    @IsDate()
    endDate?: Date | undefined;

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

    @IsNumber()
    @IsOptional()
    initialElectricIndex?: number;

    @IsNumber()
    @IsOptional()
    initialWaterIndex?: number;

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

    @IsEnum(ContractStatus)
    @IsOptional()
    status?: ContractStatus;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsString()
    @IsOptional()
    terms?: string;

    @IsMongoId()
    @IsOptional()
    roomId?: string;

    @IsMongoId()
    @IsOptional()
    tenantId?: string;

    @IsMongoId()
    @IsOptional()
    buildingId?: string;

    @IsString()
    @IsOptional()
    contractCode?: string;

    @IsMongoId()
    @IsOptional()
    ownerId?: string;

    @IsOptional()
    _id?: any;

    @IsOptional()
    __v?: any;

    @IsOptional()
    createdAt?: any;

    @IsOptional()
    updatedAt?: any;
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
    @Type(() => Date)
    @IsNotEmpty()
    @IsDate()
    startDate: Date;

    @Type(() => Date)
    @IsOptional()
    @IsDate()
    endDate?: Date | undefined;
}
