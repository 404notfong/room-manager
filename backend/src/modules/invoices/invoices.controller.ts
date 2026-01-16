import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
    constructor(private readonly invoicesService: InvoicesService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createInvoiceDto: CreateInvoiceDto) {
        return this.invoicesService.create(user.userId, createInvoiceDto);
    }

    @Get()
    findAll(@CurrentUser() user: any) {
        return this.invoicesService.findAll(user.userId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.invoicesService.findOne(id, user.userId);
    }

    @Put(':id')
    update(@Param('id') id: string, @CurrentUser() user: any, @Body() updateInvoiceDto: UpdateInvoiceDto) {
        return this.invoicesService.update(id, user.userId, updateInvoiceDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.invoicesService.remove(id, user.userId);
    }
}
