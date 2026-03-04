import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CreditCard, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RecordPaymentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: any;
    onSuccess?: () => void;
}

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'MOMO', label: 'MoMo' },
    { value: 'OTHER', label: 'Other' },
];

export default function RecordPaymentModal({
    open,
    onOpenChange,
    invoice,
    onSuccess,
}: RecordPaymentModalProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const remainingAmount = invoice?.remainingAmount || 
        ((invoice?.totalAmount || 0) - (invoice?.paidAmount || 0));

    const [amount, setAmount] = useState<string>(remainingAmount.toString());
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [paymentDate, setPaymentDate] = useState<string>(
        format(new Date(), "yyyy-MM-dd'T'HH:mm")
    );
    const [transactionId, setTransactionId] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const createPaymentMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiClient.post('/payments', data);
            return response.data;
        },
        onSuccess: () => {
            toast({
                title: t('common.success'),
                description: t('payments.recordSuccess'),
            });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            onSuccess?.();
            onOpenChange(false);
            // Reset form
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: t('common.error'),
                description: error.response?.data?.message || t('payments.recordError'),
                variant: 'destructive',
            });
        },
    });

    const resetForm = () => {
        setAmount(remainingAmount.toString());
        setPaymentMethod('CASH');
        setPaymentDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setTransactionId('');
        setNotes('');
    };

    const handleSubmit = () => {
        if (!invoice) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({
                title: t('common.error'),
                description: 'Please enter a valid amount',
                variant: 'destructive',
            });
            return;
        }

        if (numAmount > remainingAmount) {
            toast({
                title: t('common.error'),
                description: `Amount cannot exceed remaining amount (${formatCurrency(remainingAmount)})`,
                variant: 'destructive',
            });
            return;
        }

        const payload = {
            invoiceId: invoice._id,
            contractId: invoice.contractId?._id || invoice.contractId,
            tenantId: invoice.tenantId?._id || invoice.tenantId,
            amount: numAmount,
            paymentMethod,
            paymentDate: new Date(paymentDate),
            transactionId: transactionId || undefined,
            notes: notes || undefined,
        };

        createPaymentMutation.mutate(payload);
    };

    const handlePayFullAmount = () => {
        setAmount(remainingAmount.toString());
    };

    if (!invoice) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-600" />
                        {t('payments.record')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Invoice Summary */}
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('invoices.invoiceNumber')}</span>
                            <span className="font-medium">{invoice.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('invoices.totalAmount')}</span>
                            <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('invoices.paidAmount')}</span>
                            <span className="font-medium text-emerald-600">
                                {formatCurrency(invoice.paidAmount || 0)}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-medium">
                            <span>{t('invoices.remainingAmount')}</span>
                            <span className="text-red-600">{formatCurrency(remainingAmount)}</span>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">{t('payments.amount')} *</Label>
                        <div className="flex gap-2">
                            <Input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                min={0}
                                max={remainingAmount}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handlePayFullAmount}
                                className="whitespace-nowrap"
                            >
                                Pay Full
                            </Button>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label htmlFor="paymentMethod">{t('payments.method')} *</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_METHODS.map((method) => (
                                    <SelectItem key={method.value} value={method.value}>
                                        {t(`payments.method_${method.value.toLowerCase()}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Date */}
                    <div className="space-y-2">
                        <Label htmlFor="paymentDate">{t('payments.date')} *</Label>
                        <Input
                            id="paymentDate"
                            type="datetime-local"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                        />
                    </div>

                    {/* Transaction ID (optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="transactionId">Transaction ID</Label>
                        <Input
                            id="transactionId"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>

                    {/* Notes (optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">{t('payments.notes')}</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes..."
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={createPaymentMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {createPaymentMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('common.loading')}
                            </>
                        ) : (
                            <>
                                <CreditCard className="mr-2 h-4 w-4" />
                                {t('payments.record')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
