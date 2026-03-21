import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addMonths, format } from 'date-fns';
import {
    Calendar,
    Droplets,
    Loader2,
    Package, Plus,
    Receipt,
    Trash2,
    Zap
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import apiClient from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';

// Invoice creation schema
const createInvoiceSchema = z.object({
    month: z.number().min(1).max(12),
    year: z.number().min(2020).max(2100),
    previousElectricIndex: z.number().min(0),
    initialElectricIndex: z.number().min(0),
    previousWaterIndex: z.number().min(0),
    initialWaterIndex: z.number().min(0),
    dueDate: z.date(),
    notes: z.string().optional(),
    adjustments: z.array(z.object({
        description: z.string().min(1),
        amount: z.number().min(0),
        isDiscount: z.boolean()
    })).optional()
}).refine(data => data.initialElectricIndex >= data.previousElectricIndex, {
    message: "Current electric index must be >= previous",
    path: ["initialElectricIndex"]
}).refine(data => data.initialWaterIndex >= data.previousWaterIndex, {
    message: "Current water index must be >= previous",
    path: ["initialWaterIndex"]
});

type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

interface Adjustment {
    description: string;
    amount: number;
    isDiscount: boolean;
}

interface CreateInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: any;
    room?: any;
    onSuccess?: () => void;
}

const invoicesApi = {
    create: (data: any) => apiClient.post('/invoices', data).then(res => res.data),
};

export default function CreateInvoiceModal({ 
    open, 
    onOpenChange, 
    contract, 
    room,
    onSuccess 
}: CreateInvoiceModalProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [newAdjustment, setNewAdjustment] = useState({ description: '', amount: 0, isDiscount: false });

    // Get current billing period
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Default due date: 15 days from now
    const defaultDueDate = addMonths(now, 0);
    defaultDueDate.setDate(defaultDueDate.getDate() + 15);

    const form = useForm<CreateInvoiceFormData>({
        resolver: zodResolver(createInvoiceSchema),
        defaultValues: {
            month: currentMonth,
            year: currentYear,
            previousElectricIndex: room?.currentElectricIndex || contract?.initialElectricIndex || 0,
            initialElectricIndex: room?.currentElectricIndex || contract?.initialElectricIndex || 0,
            previousWaterIndex: room?.currentWaterIndex || contract?.initialWaterIndex || 0,
            initialWaterIndex: room?.currentWaterIndex || contract?.initialWaterIndex || 0,
            dueDate: defaultDueDate,
            notes: '',
        }
    });

    // Reset form when contract changes
    useEffect(() => {
        if (contract && open) {
            const roomData = room || contract.roomId;
            form.reset({
                month: currentMonth,
                year: currentYear,
                previousElectricIndex: roomData?.currentElectricIndex || contract?.initialElectricIndex || 0,
                initialElectricIndex: roomData?.currentElectricIndex || contract?.initialElectricIndex || 0,
                previousWaterIndex: roomData?.currentWaterIndex || contract?.initialWaterIndex || 0,
                initialWaterIndex: roomData?.currentWaterIndex || contract?.initialWaterIndex || 0,
                dueDate: defaultDueDate,
                notes: '',
            });
            setAdjustments([]);
        }
    }, [contract, room, open]);

    const watchValues = form.watch();

    // Calculate amounts
    const calculations = useMemo(() => {
        const electricUsed = Math.max(0, (watchValues.initialElectricIndex || 0) - (watchValues.previousElectricIndex || 0));
        const waterUsed = Math.max(0, (watchValues.initialWaterIndex || 0) - (watchValues.previousWaterIndex || 0));
        
        const electricAmount = electricUsed * (contract?.electricityPrice || 0);
        const waterAmount = waterUsed * (contract?.waterPrice || 0);
        const rentAmount = contract?.rentPrice || 0;
        
        // Service charges from contract
        const serviceTotal = (contract?.serviceCharges || []).reduce((sum: number, s: any) => 
            sum + (s.amount * (s.quantity || 1)), 0);
        
        // Adjustments
        const adjustmentTotal = adjustments.reduce((sum, adj) => 
            adj.isDiscount ? sum - adj.amount : sum + adj.amount, 0);
        
        const totalAmount = rentAmount + electricAmount + waterAmount + serviceTotal + adjustmentTotal;

        return {
            electricUsed,
            waterUsed,
            electricAmount,
            waterAmount,
            rentAmount,
            serviceTotal,
            adjustmentTotal,
            totalAmount
        };
    }, [watchValues, contract, adjustments]);

    const createMutation = useMutation({
        mutationFn: invoicesApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            toast({
                title: t('common.success'),
                description: t('invoices.createSuccess'),
            });
            onOpenChange(false);
            onSuccess?.();
        },
        onError: (error: any) => {
            toast({
                title: t('common.error'),
                description: error.response?.data?.message || t('invoices.createError'),
                variant: 'destructive',
            });
        }
    });

    const onSubmit = (data: CreateInvoiceFormData) => {
        const roomData = room || contract.roomId;
        
        createMutation.mutate({
            contractId: contract._id,
            roomId: roomData?._id || contract.roomId,
            tenantId: contract.tenantId?._id || contract.tenantId,
            month: data.month,
            year: data.year,
            invoiceType: 'REGULAR',
            previousElectricIndex: data.previousElectricIndex,
            initialElectricIndex: data.initialElectricIndex,
            electricityPrice: contract.electricityPrice,
            previousWaterIndex: data.previousWaterIndex,
            initialWaterIndex: data.initialWaterIndex,
            waterPrice: contract.waterPrice,
            rentAmount: contract.rentPrice,
            serviceCharges: contract.serviceCharges || [],
            adjustments: adjustments,
            dueDate: data.dueDate,
            notes: data.notes,
        });
    };

    const handleAddAdjustment = () => {
        if (newAdjustment.description && newAdjustment.amount > 0) {
            setAdjustments([...adjustments, { ...newAdjustment }]);
            setNewAdjustment({ description: '', amount: 0, isDiscount: false });
        }
    };

    const handleRemoveAdjustment = (index: number) => {
        setAdjustments(adjustments.filter((_, i) => i !== index));
    };

    if (!contract) return null;

    const roomData = room || contract.roomId;
    const tenantData = contract.tenantId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-emerald-600" />
                        {t('invoices.createTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {roomData?.roomName || roomData?.roomCode} - {tenantData?.fullName}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-6">
                    <Form {...form}>
                        <form id="create-invoice-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            
                            {/* Billing Period */}
                            <div className="bg-slate-50 rounded-xl p-4 border">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="h-4 w-4 text-emerald-600" />
                                    <span className="font-semibold text-sm">{t('invoices.billingPeriod')}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="month"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('invoices.month')}</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min={1} 
                                                        max={12}
                                                        {...field}
                                                        onChange={e => field.onChange(parseInt(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="year"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('invoices.year')}</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min={2020}
                                                        {...field}
                                                        onChange={e => field.onChange(parseInt(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="dueDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('invoices.dueDate')}</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="date"
                                                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                                        onChange={e => field.onChange(new Date(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Utilities Section */}
                            <div className="border rounded-xl overflow-hidden">
                                <div className="bg-amber-50 px-4 py-2.5 border-b flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-600" />
                                    <span className="font-semibold text-sm text-amber-700">{t('invoices.utilities')}</span>
                                </div>
                                <div className="p-4 bg-white">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-slate-50">
                                                <th className="text-left px-3 py-2 font-medium">{t('common.item')}</th>
                                                <th className="text-center px-3 py-2 font-medium">{t('invoices.previousIndex')}</th>
                                                <th className="text-center px-3 py-2 font-medium">{t('invoices.currentIndex')}</th>
                                                <th className="text-center px-3 py-2 font-medium">{t('invoices.usage')}</th>
                                                <th className="text-right px-3 py-2 font-medium">{t('invoices.unitPrice')}</th>
                                                <th className="text-right px-3 py-2 font-medium">{t('common.total')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Electricity */}
                                            <tr className="border-b">
                                                <td className="px-3 py-3 flex items-center gap-2">
                                                    <Zap className="h-4 w-4 text-yellow-500" />
                                                    {t('contracts.electricity')}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="previousElectricIndex"
                                                        render={({ field }) => (
                                                            <Input 
                                                                type="number" 
                                                                min={0}
                                                                className="w-24 text-center mx-auto"
                                                                {...field}
                                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                            />
                                                        )}
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="initialElectricIndex"
                                                        render={({ field }) => (
                                                            <Input 
                                                                type="number" 
                                                                min={0}
                                                                className="w-24 text-center mx-auto"
                                                                {...field}
                                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                            />
                                                        )}
                                                    />
                                                </td>
                                                <td className="text-center px-3 py-3 font-medium">
                                                    {calculations.electricUsed} kWh
                                                </td>
                                                <td className="text-right px-3 py-3">
                                                    {formatCurrency(contract.electricityPrice)}
                                                </td>
                                                <td className="text-right px-3 py-3 font-semibold text-amber-600">
                                                    {formatCurrency(calculations.electricAmount)}
                                                </td>
                                            </tr>
                                            {/* Water */}
                                            <tr>
                                                <td className="px-3 py-3 flex items-center gap-2">
                                                    <Droplets className="h-4 w-4 text-blue-500" />
                                                    {t('contracts.water')}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="previousWaterIndex"
                                                        render={({ field }) => (
                                                            <Input 
                                                                type="number" 
                                                                min={0}
                                                                className="w-24 text-center mx-auto"
                                                                {...field}
                                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                            />
                                                        )}
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="initialWaterIndex"
                                                        render={({ field }) => (
                                                            <Input 
                                                                type="number" 
                                                                min={0}
                                                                className="w-24 text-center mx-auto"
                                                                {...field}
                                                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                            />
                                                        )}
                                                    />
                                                </td>
                                                <td className="text-center px-3 py-3 font-medium">
                                                    {calculations.waterUsed} m³
                                                </td>
                                                <td className="text-right px-3 py-3">
                                                    {formatCurrency(contract.waterPrice)}
                                                </td>
                                                <td className="text-right px-3 py-3 font-semibold text-blue-600">
                                                    {formatCurrency(calculations.waterAmount)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Services Section */}
                            {contract.serviceCharges && contract.serviceCharges.length > 0 && (
                                <div className="border rounded-xl overflow-hidden">
                                    <div className="bg-purple-50 px-4 py-2.5 border-b flex items-center gap-2">
                                        <Package className="h-4 w-4 text-purple-600" />
                                        <span className="font-semibold text-sm text-purple-700">{t('invoices.services')}</span>
                                    </div>
                                    <table className="w-full text-sm bg-white">
                                        <thead>
                                            <tr className="border-b bg-slate-50">
                                                <th className="text-left px-4 py-2 font-medium">{t('contracts.serviceName')}</th>
                                                <th className="text-center px-4 py-2 font-medium">{t('contracts.quantity')}</th>
                                                <th className="text-right px-4 py-2 font-medium">{t('contracts.unitPrice')}</th>
                                                <th className="text-right px-4 py-2 font-medium">{t('common.total')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {contract.serviceCharges.map((service: any, index: number) => (
                                                <tr key={index} className="border-b last:border-b-0">
                                                    <td className="px-4 py-2.5">{service.name}</td>
                                                    <td className="text-center px-4 py-2.5">{service.quantity || 1}</td>
                                                    <td className="text-right px-4 py-2.5">{formatCurrency(service.amount)}</td>
                                                    <td className="text-right px-4 py-2.5 font-semibold text-purple-600">
                                                        {formatCurrency(service.amount * (service.quantity || 1))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-purple-50/50">
                                                <td colSpan={3} className="text-right px-4 py-2.5 font-semibold">{t('invoices.subtotal')}</td>
                                                <td className="text-right px-4 py-2.5 font-bold text-purple-700">{formatCurrency(calculations.serviceTotal)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Adjustments Section */}
                            <div className="border rounded-xl overflow-hidden">
                                <div className="bg-slate-100 px-4 py-2.5 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Plus className="h-4 w-4 text-slate-600" />
                                        <span className="font-semibold text-sm">{t('invoices.adjustments')}</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-white space-y-3">
                                    {/* Existing adjustments */}
                                    {adjustments.map((adj, index) => (
                                        <div key={index} className={cn(
                                            "flex items-center justify-between p-3 rounded-lg",
                                            adj.isDiscount ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={cn(
                                                    "text-xs",
                                                    adj.isDiscount ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                )}>
                                                    {adj.isDiscount ? t('invoices.discount') : t('invoices.additionalCharge')}
                                                </Badge>
                                                <span>{adj.description}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={cn("font-semibold", adj.isDiscount ? "text-green-600" : "text-red-600")}>
                                                    {adj.isDiscount ? '-' : '+'}{formatCurrency(adj.amount)}
                                                </span>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleRemoveAdjustment(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Add new adjustment */}
                                    <div className="flex items-end gap-2 pt-2 border-t">
                                        <div className="flex-1">
                                            <Label className="text-xs">{t('invoices.description')}</Label>
                                            <Input 
                                                placeholder={t('invoices.adjustmentPlaceholder')}
                                                value={newAdjustment.description}
                                                onChange={e => setNewAdjustment({...newAdjustment, description: e.target.value})}
                                            />
                                        </div>
                                        <div className="w-32">
                                            <Label className="text-xs">{t('invoices.amount')}</Label>
                                            <Input 
                                                type="number"
                                                min={0}
                                                value={newAdjustment.amount || ''}
                                                onChange={e => setNewAdjustment({...newAdjustment, amount: parseFloat(e.target.value) || 0})}
                                            />
                                        </div>
                                        <div className="flex gap-1">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm"
                                                className={cn(newAdjustment.isDiscount && "bg-green-100 border-green-300")}
                                                onClick={() => setNewAdjustment({...newAdjustment, isDiscount: true})}
                                            >
                                                {t('invoices.discount')}
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm"
                                                className={cn(!newAdjustment.isDiscount && "bg-red-100 border-red-300")}
                                                onClick={() => setNewAdjustment({...newAdjustment, isDiscount: false})}
                                            >
                                                {t('invoices.charge')}
                                            </Button>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="default" 
                                            size="sm"
                                            onClick={handleAddAdjustment}
                                            disabled={!newAdjustment.description || newAdjustment.amount <= 0}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('common.notes')}</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder={t('invoices.notesPlaceholder')}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Summary */}
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>{t('contracts.rentPrice')}</span>
                                        <span className="font-medium">{formatCurrency(calculations.rentAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t('contracts.electricity')}</span>
                                        <span className="font-medium">{formatCurrency(calculations.electricAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t('contracts.water')}</span>
                                        <span className="font-medium">{formatCurrency(calculations.waterAmount)}</span>
                                    </div>
                                    {calculations.serviceTotal > 0 && (
                                        <div className="flex justify-between">
                                            <span>{t('invoices.services')}</span>
                                            <span className="font-medium">{formatCurrency(calculations.serviceTotal)}</span>
                                        </div>
                                    )}
                                    {calculations.adjustmentTotal !== 0 && (
                                        <div className="flex justify-between">
                                            <span>{t('invoices.adjustments')}</span>
                                            <span className={cn("font-medium", calculations.adjustmentTotal < 0 ? "text-green-600" : "text-red-600")}>
                                                {calculations.adjustmentTotal < 0 ? '' : '+'}{formatCurrency(calculations.adjustmentTotal)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="border-t pt-2 mt-2 flex justify-between">
                                        <span className="font-bold text-lg">{t('common.total')}</span>
                                        <span className="font-bold text-2xl text-emerald-700">{formatCurrency(calculations.totalAmount)}</span>
                                    </div>
                                </div>
                            </div>

                        </form>
                    </Form>
                </DialogBody>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        form="create-invoice-form"
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('common.loading')}
                            </>
                        ) : (
                            <>
                                <Receipt className="mr-2 h-4 w-4" />
                                {t('invoices.create')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
