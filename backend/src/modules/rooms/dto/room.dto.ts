import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum, IsArray, IsMongoId, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomStatus, RoomType, ShortTermPricingType } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// DTO for short-term price tier
export class ShortTermPriceTierDto {
    @IsNumber()
    @Min(0)
    fromValue: number;

    @IsNumber()
    @Min(-1)
    toValue: number;

    @IsNumber()
    @Min(0)
    price: number;
}

export class GetRoomsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsMongoId()
    buildingId?: string;

    @IsOptional()
    @IsEnum(RoomStatus)
    status?: RoomStatus;
}

export class CreateRoomDto {
    @IsMongoId()
    @IsNotEmpty()
    buildingId: string;

    @IsMongoId()
    @IsOptional()
    roomGroupId?: string;

    // roomCode is auto-generated, not provided by user

    @IsString()
    @IsNotEmpty()
    roomName: string;

    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    floor: number;

    @IsNumber()
    @IsOptional()
    area?: number;

    @IsEnum(RoomType)
    @IsNotEmpty()
    roomType: RoomType;

    // === Long-term room fields ===
    @IsNumber()
    @IsOptional()
    @Min(1)
    defaultElectricPrice?: number;

    @IsNumber()
    @IsOptional()
    @Min(1)
    defaultWaterPrice?: number;

    @IsNumber()
    @IsOptional()
    @Min(1)
    defaultRoomPrice?: number;

    @IsNumber()
    @IsOptional()
    @Min(1)
    defaultTermMonths?: number;

    // === Short-term room fields ===
    @IsEnum(ShortTermPricingType)
    @IsOptional()
    shortTermPricingType?: ShortTermPricingType;

    @IsString()
    @IsOptional()
    hourlyPricingMode?: string;  // 'PER_HOUR' | 'TABLE'

    @IsNumber()
    @IsOptional()
    @Min(1)
    pricePerHour?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ShortTermPriceTierDto)
    @IsOptional()
    shortTermPrices?: ShortTermPriceTierDto[];

    @IsNumber()
    @IsOptional()
    @Min(1)
    fixedPrice?: number;

    // === Other fields ===
    @IsNumber()
    @IsOptional()
    maxOccupancy?: number;

    @IsEnum(RoomStatus)
    @IsOptional()
    status?: RoomStatus;

    @IsArray()
    @IsOptional()
    amenities?: string[];

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateRoomDto {
    // roomCode cannot be updated

    @IsMongoId()
    @IsOptional()
    roomGroupId?: string;

    @IsString()
    @IsOptional()
    roomName?: string;

    @IsNumber()
    @IsOptional()
    floor?: number;

    @IsNumber()
    @IsOptional()
    area?: number;

    @IsEnum(RoomType)
    @IsOptional()
    roomType?: RoomType;

    // === Long-term room fields ===
    @IsNumber()
    @IsOptional()
    @Min(0)
    defaultElectricPrice?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    defaultWaterPrice?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    defaultRoomPrice?: number;

    @IsNumber()
    @IsOptional()
    @Min(1)
    defaultTermMonths?: number;

    // === Short-term room fields ===
    @IsEnum(ShortTermPricingType)
    @IsOptional()
    shortTermPricingType?: ShortTermPricingType;

    @IsString()
    @IsOptional()
    hourlyPricingMode?: string;  // 'PER_HOUR' | 'TABLE'

    @IsNumber()
    @IsOptional()
    @Min(0)
    pricePerHour?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ShortTermPriceTierDto)
    @IsOptional()
    shortTermPrices?: ShortTermPriceTierDto[];

    @IsNumber()
    @IsOptional()
    @Min(0)
    fixedPrice?: number;

    // === Other fields ===
    @IsNumber()
    @IsOptional()
    maxOccupancy?: number;

    @IsEnum(RoomStatus)
    @IsOptional()
    status?: RoomStatus;

    @IsArray()
    @IsOptional()
    amenities?: string[];

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateIndexesDto {
    @IsNumber()
    @IsOptional()
    currentElectricIndex?: number;

    @IsNumber()
    @IsOptional()
    currentWaterIndex?: number;
}
