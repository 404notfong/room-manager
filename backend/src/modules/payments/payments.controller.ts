import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { PaymentQueryDto } from '@modules/payments/dto/payment-query.dto';
import { CreatePaymentDto, UpdatePaymentDto } from '@modules/payments/dto/payment.dto';
import { PaymentsService } from '@modules/payments/payments.service';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createPaymentDto: CreatePaymentDto) {
        return this.paymentsService.create(user.userId, user.userId, createPaymentDto);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() query: PaymentQueryDto) {
        return this.paymentsService.findAll(user.userId, query);
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
