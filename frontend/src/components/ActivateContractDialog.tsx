import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Loader2, FileText } from 'lucide-react';

const activateSchema = z.object({
    startDate: z.string().min(1, 'Required'),
    endDate: z.string().optional().nullable(),
});

type ActivateFormValues = z.infer<typeof activateSchema>;

interface ActivateContractDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: ActivateFormValues) => void;
    initialData: {
        startDate: string;
        endDate?: string | null;
    };
    isSubmitting?: boolean;
}

export const ActivateContractDialog: React.FC<ActivateContractDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    initialData,
    isSubmitting,
}) => {
    const { t } = useTranslation();

    const form = useForm<ActivateFormValues>({
        resolver: zodResolver(activateSchema),
        defaultValues: {
            startDate: initialData.startDate ? format(new Date(initialData.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            endDate: initialData.endDate ? format(new Date(initialData.endDate), 'yyyy-MM-dd') : null,
        },
    });

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
                                            <DatePicker
                                                value={field.value}
                                                onChange={(date) => {
                                                    field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                                                }}
                                                className={fieldState.error ? "border-destructive ring-destructive/20" : ""}
                                            />
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
                                            <DatePicker
                                                value={field.value || undefined}
                                                onChange={(date) => {
                                                    field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                                                }}
                                                className={fieldState.error ? "border-destructive ring-destructive/20" : ""}
                                                placeholder={t('contracts.endDatePlaceholder', 'Không thời hạn')}
                                            />
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
