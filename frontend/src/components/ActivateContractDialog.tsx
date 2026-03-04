import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { validateContractEndDate } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { FileText, Loader2 } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

const createActivateSchema = (contractType: string, cycleMonths: number, dueDay: number) => {
    return z.object({
        startDate: z.string().min(1, 'Required'),
        endDate: z.string().optional().nullable(),
    }).refine((data) => {
        if (data.startDate && data.endDate) {
            // For Long Term, enforce strict Payment Due check
            // Example: startDate=20/01, cycle=3, dueDay=22 => endDate must be > 22/04
            if (contractType === 'LONG_TERM') {
                return validateContractEndDate(data.startDate, data.endDate, cycleMonths, dueDay);
            }
            // For Short Term, just basic start < end
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            return end > start;
        }
        return true;
    }, {
        message: 'Ngày kết thúc phải sau ngày thanh toán chu kỳ đầu tiên',
        path: ['endDate'],
    });
};

type ActivateFormValues = { startDate: string; endDate?: string | null };

interface ActivateContractDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: ActivateFormValues) => void;
    initialData: {
        startDate: string;
        endDate?: string | null;
    };
    isSubmitting?: boolean;
    contractType?: 'SHORT_TERM' | 'LONG_TERM';
    paymentCycleMonths?: number;
    paymentDueDay?: number;
}

export const ActivateContractDialog: React.FC<ActivateContractDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    initialData,
    isSubmitting,
    contractType = 'LONG_TERM',
    paymentCycleMonths = 1,
    paymentDueDay = 1,
}) => {
    const { t } = useTranslation();
    const isShortTerm = contractType === 'SHORT_TERM';

    // Dynamic schema based on props
    const activateSchema = React.useMemo(() => 
        createActivateSchema(contractType, paymentCycleMonths, paymentDueDay), 
        [contractType, paymentCycleMonths, paymentDueDay]
    );

    const form = useForm<ActivateFormValues>({
        resolver: zodResolver(activateSchema),
        mode: 'onChange',
        defaultValues: {
            // For SHORT_TERM, keep full ISO string; for LONG_TERM, use date only
            startDate: initialData.startDate 
                ? (isShortTerm ? new Date(initialData.startDate).toISOString() : format(new Date(initialData.startDate), 'yyyy-MM-dd'))
                : (isShortTerm ? new Date().toISOString() : format(new Date(), 'yyyy-MM-dd')),
            endDate: initialData.endDate 
                ? (isShortTerm ? new Date(initialData.endDate).toISOString() : format(new Date(initialData.endDate), 'yyyy-MM-dd'))
                : null,
        },
    });

    // Reset form when schema/props change or dialog opens
    React.useEffect(() => {
        if (isOpen) {
             form.reset({
                startDate: initialData.startDate 
                    ? (isShortTerm ? new Date(initialData.startDate).toISOString() : format(new Date(initialData.startDate), 'yyyy-MM-dd'))
                    : (isShortTerm ? new Date().toISOString() : format(new Date(), 'yyyy-MM-dd')),
                endDate: initialData.endDate 
                    ? (isShortTerm ? new Date(initialData.endDate).toISOString() : format(new Date(initialData.endDate), 'yyyy-MM-dd'))
                    : null,
             });
        }
    }, [isOpen, initialData, isShortTerm, form]);

    const startDate = form.watch('startDate');


    const handleSubmit = (values: ActivateFormValues) => {
        onConfirm(values);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] gap-6">
                <DialogHeader className="gap-2">
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="flex items-center gap-2">
                            <span className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400">
                                <FileText className="h-5 w-5" />
                            </span>
                            {t('contracts.activateTitle')}
                        </DialogTitle>
                        <DialogDescription className="text-left pt-1">
                            {t('contracts.activateDescription')}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                        <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field, fieldState }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="flex items-center gap-1.5 text-xs uppercase font-bold text-muted-foreground/80">
                                            {t('contracts.startDate')}
                                            <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            {isShortTerm ? (
                                                <DateTimePicker
                                                    value={field.value}
                                                    onChange={(date) => {
                                                        field.onChange(date ? date.toISOString() : '');
                                                    }}
                                                    showTime={true}
                                                    className={fieldState.error ? "border-destructive ring-destructive/20" : ""}
                                                />
                                            ) : (
                                                <DatePicker
                                                    value={field.value}
                                                    onChange={(date) => {
                                                        field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                                                    }}
                                                    className={fieldState.error ? "border-destructive ring-destructive/20" : ""}
                                                />
                                            )}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field, fieldState }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="flex items-center gap-1.5 text-xs uppercase font-bold text-muted-foreground/80">
                                            {t('contracts.endDate')}
                                        </FormLabel>
                                        <FormControl>
                                            {isShortTerm ? (
                                                <DateTimePicker
                                                    value={field.value}
                                                    onChange={(date) => {
                                                        field.onChange(date ? date.toISOString() : '');
                                                    }}
                                                    showTime={true}
                                                    disabledDate={(date) => {
                                                        if (!startDate) return false;
                                                        const start = new Date(startDate);
                                                        start.setHours(0, 0, 0, 0);
                                                        return date < start;
                                                    }}
                                                    className={fieldState.error ? "border-destructive ring-destructive/20" : ""}
                                                />
                                            ) : (
                                                <DatePicker
                                                    value={field.value || undefined}
                                                    onChange={(date) => {
                                                        field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                                                    }}
                                                    disabledDate={(date) => {
                                                        if (!startDate) return false;
                                                        const start = new Date(startDate);
                                                        start.setHours(0, 0, 0, 0);
                                                        
                                                        // For LONG_TERM: disable dates <= first payment due date
                                                        // Example: startDate=20/01, cycle=3, dueDay=22 => disable <= 22/04
                                                        if (!isShortTerm) {
                                                            // Step 1: Add cycle months to start date
                                                            const targetMonth = new Date(start);
                                                            targetMonth.setMonth(targetMonth.getMonth() + paymentCycleMonths);
                                                            
                                                            // Step 2: Set due day (handle month overflow)
                                                            const year = targetMonth.getFullYear();
                                                            const month = targetMonth.getMonth();
                                                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                                                            const actualDueDay = Math.min(paymentDueDay, daysInMonth);
                                                            
                                                            const firstDueDate = new Date(year, month, actualDueDay);
                                                            firstDueDate.setHours(0, 0, 0, 0);

                                                            // Disable if date is ON or BEFORE first payment due date
                                                            return date <= firstDueDate;
                                                        }
                                                        
                                                        // For SHORT_TERM, just disable dates before start
                                                        return date <= start;
                                                    }}
                                                    className={fieldState.error ? "border-destructive ring-destructive/20" : ""}
                                                    placeholder={t('contracts.endDatePlaceholder', 'Không thời hạn')}
                                                />
                                            )}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('contracts.activateConfirm')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
