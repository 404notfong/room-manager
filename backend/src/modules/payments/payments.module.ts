import { Invoice, InvoiceSchema } from '@modules/invoices/schemas/invoice.schema';
import { PaymentsController } from '@modules/payments/payments.controller';
import { PaymentsService } from '@modules/payments/payments.service';
import { Payment, PaymentSchema } from '@modules/payments/schemas/payment.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Payment.name, schema: PaymentSchema },
            { name: Invoice.name, schema: InvoiceSchema },
        ]),
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule { }

