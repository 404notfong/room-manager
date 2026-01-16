import { IsString, IsOptional, IsBoolean, IsNumber, MaxLength, IsNotEmpty, IsMongoId, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateRoomGroupDto {
    @IsMongoId()
    @IsNotEmpty()
    buildingId: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @IsOptional()
    @IsNumber()
    sortOrder?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class GetRoomGroupsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsMongoId()
    buildingId?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateRoomGroupDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @IsOptional()
    @IsNumber()
    sortOrder?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
