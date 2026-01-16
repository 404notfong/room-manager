import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createPaymentDto: CreatePaymentDto) {
        return this.paymentsService.create(user.userId, user.userId, createPaymentDto);
    }

    @Get()
    findAll(@CurrentUser() user: any) {
        return this.paymentsService.findAll(user.userId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.paymentsService.findOne(id, user.userId);
    }

    @Put(':id')
    update(@Param('id') id: string, @CurrentUser() user: any, @Body() updatePaymentDto: UpdatePaymentDto) {
        return this.paymentsService.update(id, user.userId, updatePaymentDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.paymentsService.remove(id, user.userId);
    }
}
