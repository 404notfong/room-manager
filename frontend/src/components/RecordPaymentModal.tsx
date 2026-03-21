import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
    Dialog,
    DialogBody,
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
import { CreditCard, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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

// Format number with thousand separators (e.g., 1,000,000)
function formatNumberInput(value: string): string {
    const num = value.replace(/[^0-9]/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('en-US');
}

// Parse formatted string back to number
function parseFormattedNumber(value: string): number {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
}

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

    const [amount, setAmount] = useState<string>(formatNumberInput(remainingAmount.toString()));
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [paymentDate, setPaymentDate] = useState<Date>(new Date());
    const [transactionId, setTransactionId] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Reset form when modal opens with new invoice
    useEffect(() => {
        if (open && invoice) {
            const remaining = invoice?.remainingAmount || 
                ((invoice?.totalAmount || 0) - (invoice?.paidAmount || 0));
            setAmount(formatNumberInput(remaining.toString()));
            setPaymentMethod('CASH');
            setPaymentDate(new Date());
            setTransactionId('');
            setNotes('');
        }
    }, [open, invoice]);

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
        },
        onError: (error: any) => {
            toast({
                title: t('common.error'),
                description: error.response?.data?.message || t('payments.recordError'),
                variant: 'destructive',
            });
        },
    });

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatNumberInput(e.target.value);
        setAmount(formatted);
    };

    const handleSubmit = () => {
        if (!invoice) return;

        const numAmount = parseFormattedNumber(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({
                title: t('common.error'),
                description: t('payments.invalidAmount'),
                variant: 'destructive',
            });
            return;
        }

        if (numAmount > remainingAmount) {
            toast({
                title: t('common.error'),
                description: t('payments.amountExceedsRemaining', { amount: formatCurrency(remainingAmount) }),
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
            paymentDate,
            transactionId: transactionId || undefined,
            notes: notes || undefined,
        };

        createPaymentMutation.mutate(payload);
    };

    const handlePayFullAmount = () => {
        setAmount(formatNumberInput(remainingAmount.toString()));
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

                <DialogBody>
                <div className="space-y-4">
                    {/* Invoice Summary */}
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
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
                        <Label htmlFor="amount">{t('payments.amount')} <span className="text-destructive">*</span></Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="amount"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    placeholder="0"
                                    className="pr-10"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePayFullAmount}
                                className="whitespace-nowrap"
                            >
                                {t('payments.payFull')}
                            </Button>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label htmlFor="paymentMethod">{t('payments.method')} <span className="text-destructive">*</span></Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('payments.selectMethod')} />
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
                        <Label>{t('payments.date')} <span className="text-destructive">*</span></Label>
                        <DateTimePicker
                            value={paymentDate}
                            onChange={(date) => { if (date) setPaymentDate(date); }}
                            placeholder={t('payments.date')}
                        />
                    </div>

                    {/* Transaction ID (optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="transactionId">{t('payments.transactionId')}</Label>
                        <Input
                            id="transactionId"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder={t('common.optional')}
                        />
                    </div>

                    {/* Notes (optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">{t('payments.notes')}</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('common.optional')}
                            rows={2}
                        />
                    </div>
                </div>
                </DialogBody>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={createPaymentMutation.isPending}
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
