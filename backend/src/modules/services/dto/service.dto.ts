import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum, IsArray, IsBoolean, ValidateNested, IsMongoId, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

class ServicePriceTierDto {
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

export class GetServicesDto extends PaginationDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsMongoId()
    buildingId?: string;
}

export class CreateServiceDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    unit: string;

    @IsEnum(['FIXED', 'TABLE'])
    @IsOptional()
    priceType?: string;

    @IsNumber()
    @IsOptional()
    fixedPrice?: number;

    @ValidateNested({ each: true })
    @Type(() => ServicePriceTierDto)
    @IsOptional()
    priceTiers?: ServicePriceTierDto[];

    @IsEnum(['ALL', 'SPECIFIC'])
    @IsOptional()
    buildingScope?: string;

    @IsArray()
    @IsMongoId({ each: true })
    @IsOptional()
    buildingIds?: string[];

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class UpdateServiceDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsEnum(['FIXED', 'TABLE'])
    @IsOptional()
    priceType?: string;

    @IsNumber()
    @IsOptional()
    fixedPrice?: number;

    @ValidateNested({ each: true })
    @Type(() => ServicePriceTierDto)
    @IsOptional()
    priceTiers?: ServicePriceTierDto[];

    @IsEnum(['ALL', 'SPECIFIC'])
    @IsOptional()
    buildingScope?: string;

    @IsArray()
    @IsMongoId({ each: true })
    @IsOptional()
    buildingIds?: string[];

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
