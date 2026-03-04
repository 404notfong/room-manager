import { ContractsController } from '@modules/contracts/contracts.controller';
import { ContractsService } from '@modules/contracts/contracts.service';
import { Contract, ContractSchema } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceSchema } from '@modules/invoices/schemas/invoice.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RoomsModule } from '@modules/rooms/rooms.module';
import { ServicesModule } from '@modules/services/services.module';
import { TenantsModule } from '@modules/tenants/tenants.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Contract.name, schema: ContractSchema },
            { name: Invoice.name, schema: InvoiceSchema },
        ]),
        RoomsModule,
        TenantsModule,
        ServicesModule,
    ],
    controllers: [ContractsController],
    providers: [ContractsService],
    exports: [ContractsService],
})
export class ContractsModule { }
