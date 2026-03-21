import { PaginationDto } from '@common/dto/pagination.dto';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class InvoiceQueryDto extends PaginationDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsMongoId()
    buildingId?: string;
}
