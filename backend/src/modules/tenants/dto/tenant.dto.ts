import { IsNotEmpty, IsString, IsOptional, IsEmail, IsDateString, IsEnum, IsMongoId, ValidateNested, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { TenantStatus } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

class EmergencyContactDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    relationship?: string;
}

export class CreateTenantDto {
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsString()
    @IsNotEmpty()
    idCard: string;

    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @IsString()
    @IsOptional()
    gender?: string;

    @IsString()
    @IsOptional()
    permanentAddress?: string;

    @ValidateNested()
    @Type(() => EmergencyContactDto)
    @IsOptional()
    emergencyContact?: EmergencyContactDto;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsString()
    @IsOptional()
    occupation?: string;

    @IsEnum(TenantStatus)
    @IsIn([TenantStatus.ACTIVE, TenantStatus.CLOSED], { message: 'Cannot manually set status to RENTING' })
    @IsOptional()
    status?: TenantStatus;
}

export class UpdateTenantDto {
    @IsString()
    @IsOptional()
    fullName?: string;

    @IsString()
    @IsOptional()
    idCard?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @IsString()
    @IsOptional()
    gender?: string;

    @IsMongoId()
    @IsOptional()
    currentRoomId?: string;

    @IsDateString()
    @IsOptional()
    moveInDate?: string;

    @IsDateString()
    @IsOptional()
    moveOutDate?: string;

    @IsEnum(TenantStatus)
    @IsIn([TenantStatus.ACTIVE, TenantStatus.CLOSED], { message: 'Cannot manually set status to RENTING' })
    @IsOptional()
    status?: TenantStatus;

    @ValidateNested()
    @Type(() => EmergencyContactDto)
    @IsOptional()
    emergencyContact?: EmergencyContactDto;

    @IsString()
    @IsOptional()
    occupation?: string;

    @IsString()
    @IsOptional()
    permanentAddress?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class GetTenantsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(TenantStatus)
    status?: TenantStatus;

    @IsOptional()
    @IsMongoId()
    currentRoomId?: string;
}
