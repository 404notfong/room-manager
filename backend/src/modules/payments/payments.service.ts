import { InvoiceStatus } from '@common/constants/enums';
import { Invoice, InvoiceDocument } from '@modules/invoices/schemas/invoice.schema';
import { CreatePaymentDto, UpdatePaymentDto } from '@modules/payments/dto/payment.dto';
import { Payment, PaymentDocument } from '@modules/payments/schemas/payment.schema';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    ) { }

    async create(ownerId: string, receivedBy: string, createPaymentDto: CreatePaymentDto): Promise<Payment> {
        // 1. Get the invoice
        const invoice = await this.invoiceModel.findOne({
            _id: new Types.ObjectId(createPaymentDto.invoiceId),
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false,
        });

        if (!invoice) {
            throw new NotFoundException('Invoice not found');
        }

        if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException(`Cannot add payment to ${invoice.status.toLowerCase()} invoice`);
        }

        // 2. Validate payment amount
        const currentRemaining = invoice.totalAmount - (invoice.paidAmount || 0);
        if (createPaymentDto.amount > currentRemaining) {
            throw new BadRequestException(`Payment amount exceeds remaining amount (${currentRemaining})`);
        }

        // 3. Create the payment
        const payment = new this.paymentModel({
            ...createPaymentDto,
            invoiceId: new Types.ObjectId(createPaymentDto.invoiceId),
            contractId: invoice.contractId,
            tenantId: invoice.tenantId,
            ownerId: new Types.ObjectId(ownerId),
            receivedBy: new Types.ObjectId(receivedBy),
        });
        await payment.save();

        // 4. Update invoice paidAmount, remainingAmount, and status
        const newPaidAmount = (invoice.paidAmount || 0) + createPaymentDto.amount;
        const newRemainingAmount = invoice.totalAmount - newPaidAmount;
        
        let newStatus: InvoiceStatus = invoice.status as InvoiceStatus;
        if (newRemainingAmount <= 0) {
            newStatus = InvoiceStatus.PAID;
        } else if (newPaidAmount > 0) {
            newStatus = InvoiceStatus.PARTIAL;
        }

        await this.invoiceModel.updateOne(
            { _id: invoice._id },
            {
                $set: {
                    paidAmount: newPaidAmount,
                    remainingAmount: newRemainingAmount,
                    status: newStatus,
                    ...(newStatus === InvoiceStatus.PAID ? { paidDate: new Date() } : {}),
                },
            },
        );

        this.logger.log(`Payment ${payment._id} recorded. Invoice ${invoice._id}: ${invoice.paidAmount} -> ${newPaidAmount}, status: ${newStatus}`);

        return payment;
    }

    async findAll(ownerId: string): Promise<Payment[]> {
        return this.paymentModel.find({ ownerId: new Types.ObjectId(ownerId), isDeleted: false })
            .populate('contractId tenantId')
            .populate({
                path: 'invoiceId',
                populate: { path: 'roomId', populate: { path: 'buildingId' } }
            })
            .sort({ paymentDate: -1 })
            .exec();
    }

    async findByInvoice(invoiceId: string, ownerId: string): Promise<Payment[]> {
        return this.paymentModel.find({
            invoiceId: new Types.ObjectId(invoiceId),
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false
        })
            .sort({ paymentDate: -1 })
            .exec();
    }

    async findOne(id: string, ownerId: string): Promise<Payment> {
        const payment = await this.paymentModel.findOne({ 
            _id: new Types.ObjectId(id), 
            ownerId: new Types.ObjectId(ownerId), 
            isDeleted: false 
        }).populate('invoiceId contractId tenantId').exec();
        if (!payment) throw new NotFoundException('Payment not found');
        return payment;
    }

    async update(id: string, ownerId: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
        const payment = await this.paymentModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(id), ownerId: new Types.ObjectId(ownerId), isDeleted: false }, 
                { $set: updatePaymentDto }, 
                { new: true }
            )
            .exec();
        if (!payment) throw new NotFoundException('Payment not found');
        return payment;
    }

    async remove(id: string, ownerId: string): Promise<void> {
        // Get the payment first to recalculate invoice amounts
        const payment = await this.paymentModel.findOne({
            _id: new Types.ObjectId(id),
            ownerId: new Types.ObjectId(ownerId),
            isDeleted: false,
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // Soft delete the payment
        await this.paymentModel.updateOne(
            { _id: payment._id },
            { $set: { isDeleted: true } },
        );

        // Recalculate invoice amounts
        const invoice = await this.invoiceModel.findById(payment.invoiceId);
        if (invoice) {
            const newPaidAmount = (invoice.paidAmount || 0) - payment.amount;
            const newRemainingAmount = invoice.totalAmount - newPaidAmount;
            
            let newStatus = InvoiceStatus.PENDING;
            if (newPaidAmount >= invoice.totalAmount) {
                newStatus = InvoiceStatus.PAID;
            } else if (newPaidAmount > 0) {
                newStatus = InvoiceStatus.PARTIAL;
            } else if (invoice.dueDate < new Date()) {
                newStatus = InvoiceStatus.OVERDUE;
            }

            await this.invoiceModel.updateOne(
                { _id: invoice._id },
                {
                    $set: {
                        paidAmount: Math.max(0, newPaidAmount),
                        remainingAmount: newRemainingAmount,
                        status: newStatus,
                    },
                },
            );

            this.logger.log(`Payment ${id} deleted. Invoice ${invoice._id}: paidAmount adjusted to ${newPaidAmount}`);
        }
    }
}
