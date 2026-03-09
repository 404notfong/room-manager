import { Contract, ContractSchema } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceSchema } from '@modules/invoices/schemas/invoice.schema';
import { Payment, PaymentSchema } from '@modules/payments/schemas/payment.schema';
import { Tenant, TenantSchema } from '@modules/tenants/schemas/tenant.schema';
import { TenantsController } from '@modules/tenants/tenants.controller';
import { TenantsService } from '@modules/tenants/tenants.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Tenant.name, schema: TenantSchema },
            { name: Contract.name, schema: ContractSchema },
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Payment.name, schema: PaymentSchema },
        ]),
    ],
    controllers: [TenantsController],
    providers: [TenantsService],
    exports: [TenantsService],
})
export class TenantsModule { }
