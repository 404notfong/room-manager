import apiClient from '@/api/client';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';
import Pagination from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ColumnConfig, useColumnVisibility } from '@/hooks/useColumnVisibility';
import { useDebounce } from '@/hooks/useDebounce';
import { useBuildingStore } from '@/stores/buildingStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, Search, Smartphone, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Payment {
    _id: string;
    invoice: { _id: string; invoiceNumber: string };
    invoiceId?: { _id: string; invoiceNumber?: string; roomId?: { _id: string; buildingId?: { _id: string } } };
    amount: number;
    paymentMethod: 'cash' | 'bank_transfer' | 'momo' | 'other';
    paymentDate: string;
    notes?: string;
    createdAt: string;
}

const paymentsApi = {
    getAll: async (params: { page: number; limit: number; search?: string; buildingId?: string }) => {
        const response = await apiClient.get('/payments', { params });
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/payments/${id}`);
        return response.data;
    },
};

export default function PaymentsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Column visibility configuration
    const columnConfig: ColumnConfig[] = [
        { id: 'invoice', label: t('payments.invoice') },
        { id: 'amount', label: t('payments.amount') },
        { id: 'method', label: t('payments.method') },
        { id: 'date', label: t('payments.date') },
        { id: 'notes', label: t('payments.notes') },
    ];
    const columnVisibility = useColumnVisibility('payments', columnConfig);

    const { data, isPending } = useQuery({
        queryKey: ['payments', { page: currentPage, limit: pageSize, search: debouncedSearchTerm, buildingId: selectedBuildingId || undefined }],
        queryFn: () => paymentsApi.getAll({ page: currentPage, limit: pageSize, search: debouncedSearchTerm, buildingId: selectedBuildingId || undefined }),
    });

    const payments: Payment[] = Array.isArray(data?.data) ? data.data : [];
    const meta = data?.meta || { total: 0, totalPages: 1 };

    const deleteMutation = useMutation({
        mutationFn: paymentsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            setIsDeleteOpen(false);
            setSelectedPayment(null);
            toast({ title: t('payments.deleteSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('payments.deleteError') });
        },
    });

    const handleDelete = (payment: Payment) => {
        setSelectedPayment(payment);
        setIsDeleteOpen(true);
    };

    const getMethodBadge = (method: string) => {
        const icons: Record<string, React.ReactNode> = {
            cash: <Banknote className="h-3 w-3 mr-1" />,
            bank_transfer: <Wallet className="h-3 w-3 mr-1" />,
            momo: <Smartphone className="h-3 w-3 mr-1" />,
            other: <CreditCard className="h-3 w-3 mr-1" />,
        };
        const colors: Record<string, string> = {
            cash: 'bg-green-500',
            bank_transfer: 'bg-blue-500',
            momo: 'bg-pink-500',
            other: 'bg-gray-500',
        };
        return (
            <Badge className={colors[method] || 'bg-gray-500'}>
                <span className="flex items-center">
                    {icons[method]}
                    {t(`payments.method_${method}`)}
                </span>
            </Badge>
        );
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('vi-VN');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    // Reset to page 1 when search changes
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('payments.title')}</h1>
                    <p className="text-muted-foreground">{t('payments.subtitle')}</p>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('common.search')}
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            {t('payments.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('payments.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isPending ? (
                        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                    ) : payments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('payments.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('invoice') && <TableHead>{t('payments.invoice')}</TableHead>}
                                    {columnVisibility.isVisible('amount') && <TableHead className="text-right">{t('payments.amount')}</TableHead>}
                                    {columnVisibility.isVisible('method') && <TableHead>{t('payments.method')}</TableHead>}
                                    {columnVisibility.isVisible('date') && <TableHead>{t('payments.date')}</TableHead>}
                                    {columnVisibility.isVisible('notes') && <TableHead>{t('payments.notes')}</TableHead>}
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((payment) => (
                                    <TableRow key={payment._id}>
                                        {columnVisibility.isVisible('invoice') && (
                                            <TableCell className="font-medium">
                                                {payment.invoice?.invoiceNumber || payment.invoiceId?.invoiceNumber || '-'}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('amount') && (
                                            <TableCell className="text-right font-medium text-green-600">
                                                {formatCurrency(payment.amount)}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('method') && (
                                            <TableCell>{getMethodBadge(payment.paymentMethod)}</TableCell>
                                        )}
                                        {columnVisibility.isVisible('date') && (
                                            <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                                        )}
                                        {columnVisibility.isVisible('notes') && (
                                            <TableCell className="max-w-[200px] truncate">
                                                {payment.notes || '-'}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(payment)} className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {meta.total > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={meta.totalPages}
                            pageSize={pageSize}
                            totalItems={meta.total}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setCurrentPage(1);
                            }}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Delete Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('payments.deleteTitle')}</DialogTitle>
                        <DialogDescription>{t('payments.deleteConfirm')}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedPayment && deleteMutation.mutate(selectedPayment._id)}
                            disabled={deleteMutation.isPending}
                        >
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
