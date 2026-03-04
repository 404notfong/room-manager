import { Contract, ContractSchema } from '@modules/contracts/schemas/contract.schema';
import { Invoice, InvoiceSchema } from '@modules/invoices/schemas/invoice.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Contract.name, schema: ContractSchema },
            { name: Invoice.name, schema: InvoiceSchema },
        ]),
    ],
    controllers: [CalendarController],
    providers: [CalendarService],
    exports: [CalendarService],
})
export class CalendarModule { }
