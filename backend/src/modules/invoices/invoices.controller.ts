import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { InvoiceQueryDto } from '@modules/invoices/dto/invoice-query.dto';
import { CreateInvoiceDto, UpdateInvoiceDto } from '@modules/invoices/dto/invoice.dto';
import { InvoicesService } from '@modules/invoices/invoices.service';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
    constructor(private readonly invoicesService: InvoicesService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createInvoiceDto: CreateInvoiceDto) {
        return this.invoicesService.create(user.userId, createInvoiceDto);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() query: InvoiceQueryDto) {
        return this.invoicesService.findAll(user.userId, query);
    }

    @Get('contract/:contractId')
    findByContract(@Param('contractId') contractId: string, @CurrentUser() user: any) {
        return this.invoicesService.findByContract(contractId, user.userId);
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
