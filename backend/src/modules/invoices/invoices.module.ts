import { Contract, ContractSchema } from '@modules/contracts/schemas/contract.schema';
import { InvoicesController } from '@modules/invoices/invoices.controller';
import { InvoicesService } from '@modules/invoices/invoices.service';
import { Invoice, InvoiceSchema } from '@modules/invoices/schemas/invoice.schema';
import { Room, RoomSchema } from '@modules/rooms/schemas/room.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Contract.name, schema: ContractSchema },
            { name: Room.name, schema: RoomSchema },
        ])
    ],
    controllers: [InvoicesController],
    providers: [InvoicesService],
    exports: [InvoicesService],
})
export class InvoicesModule { }
