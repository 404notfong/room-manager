import { IsNotEmpty, IsMongoId, IsNumber, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../../common/constants/enums';

export class CreatePaymentDto {
    @IsMongoId()
    @IsNotEmpty()
    invoiceId: string;

    @IsMongoId()
    @IsNotEmpty()
    contractId: string;

    @IsMongoId()
    @IsNotEmpty()
    tenantId: string;

    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @IsEnum(PaymentMethod)
    @IsOptional()
    paymentMethod?: PaymentMethod;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    paymentDate: Date;

    @IsString()
    @IsOptional()
    transactionId?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdatePaymentDto {
    @IsNumber()
    @IsOptional()
    amount?: number;

    @IsEnum(PaymentMethod)
    @IsOptional()
    paymentMethod?: PaymentMethod;

    @IsString()
    @IsOptional()
    notes?: string;
}
