import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { UserRole } from '../../../common/constants/enums';

export class CreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;
}
