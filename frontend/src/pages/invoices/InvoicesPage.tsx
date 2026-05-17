import apiClient from '@/api/client';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';
import Pagination from '@/components/Pagination';
import RecordPaymentModal from '@/components/RecordPaymentModal';
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
import { AlertCircle, CreditCard, Eye, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface Invoice {
    _id: string;
    invoiceNumber: string;
    contractId: { _id: string; contractCode?: string };
    tenantId: { _id: string; fullName: string };
    roomId: { _id: string; roomCode: string; buildingId?: { _id: string } };
    billingPeriod: { month: number; year: number };
    rentAmount: number;
    electricityAmount: number;
    waterAmount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate: string;
    status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    createdAt: string;
}

const invoicesApi = {
    getAll: async (params: { page: number; limit: number; search?: string; buildingId?: string }) => {
        const response = await apiClient.get('/invoices', { params });
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/invoices/${id}`);
        return response.data;
    },
};

export default function InvoicesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);



    // Column visibility configuration
    const columnConfig: ColumnConfig[] = [
        { id: 'invoiceNumber', label: t('invoices.invoiceNumber') },
        { id: 'tenant', label: t('invoices.tenant') },
        { id: 'room', label: t('invoices.room') },
        { id: 'period', label: t('invoices.period') },
        { id: 'totalAmount', label: t('invoices.totalAmount') },
        { id: 'paidAmount', label: t('invoices.paidAmount') },
        { id: 'remainingAmount', label: t('invoices.remainingAmount') },
        { id: 'dueDate', label: t('invoices.dueDate') },
        { id: 'status', label: t('common.status') },
    ];
    const columnVisibility = useColumnVisibility('invoices', columnConfig);

    const { data, isPending } = useQuery({
        queryKey: ['invoices', { page: currentPage, limit: pageSize, search: debouncedSearchTerm, buildingId: selectedBuildingId || undefined }],
        queryFn: () => invoicesApi.getAll({ page: currentPage, limit: pageSize, search: debouncedSearchTerm, buildingId: selectedBuildingId || undefined }),
    });

    const invoices: Invoice[] = Array.isArray(data?.data) ? data.data : [];
    const meta = data?.meta || { total: 0, totalPages: 1 };

    const deleteMutation = useMutation({
        mutationFn: invoicesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setIsDeleteOpen(false);
            setSelectedInvoice(null);
            toast({ title: t('invoices.deleteSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('invoices.deleteError') });
        },
    });

    const handleDelete = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setIsDeleteOpen(true);
    };



    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return <Badge className="bg-green-500 text-white border-0">{t('invoices.statusPaid')}</Badge>;
            case 'PENDING':
                return <Badge className="bg-yellow-500 text-white border-0">{t('invoices.statusPending')}</Badge>;
            case 'OVERDUE':
                return <Badge className="bg-red-500 text-white border-0">{t('invoices.statusOverdue')}</Badge>;
            case 'CANCELLED':
                return <Badge className="bg-gray-500 text-white border-0">{t('invoices.statusCancelled')}</Badge>;
            case 'PARTIAL':
                return <Badge className="bg-blue-500 text-white border-0">{t('invoices.statusPartial')}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const isOverdue = (dueDate: string, status: string) => {
        return status === 'PENDING' && new Date(dueDate) < new Date();
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
                    <h1 className="text-3xl font-bold tracking-tight">{t('invoices.title')}</h1>
                    <p className="text-muted-foreground">{t('invoices.subtitle')}</p>
                </div>
                <Button onClick={() => navigate('/invoices/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('invoices.generate')}
                </Button>
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
                            <Receipt className="h-5 w-5" />
                            {t('invoices.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('invoices.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isPending ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {t('common.loading')}
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('invoices.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('invoiceNumber') && <TableHead className="w-[120px]">{t('invoices.invoiceNumber')}</TableHead>}
                                    {columnVisibility.isVisible('tenant') && <TableHead className="w-[150px]">{t('invoices.tenant')}</TableHead>}
                                    {columnVisibility.isVisible('room') && <TableHead className="w-[100px]">{t('invoices.room')}</TableHead>}
                                    {columnVisibility.isVisible('period') && <TableHead className="w-[100px]">{t('invoices.period')}</TableHead>}
                                    {columnVisibility.isVisible('totalAmount') && <TableHead className="text-right w-[130px]">{t('invoices.totalAmount')}</TableHead>}
                                    {columnVisibility.isVisible('paidAmount') && <TableHead className="text-right w-[120px]">{t('invoices.paidAmount')}</TableHead>}
                                    {columnVisibility.isVisible('remainingAmount') && <TableHead className="text-right w-[120px]">{t('invoices.remainingAmount')}</TableHead>}
                                    {columnVisibility.isVisible('dueDate') && <TableHead className="w-[100px]">{t('invoices.dueDate')}</TableHead>}
                                    {columnVisibility.isVisible('status') && <TableHead className="text-center w-[100px]">{t('common.status')}</TableHead>}
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((invoice) => (
                                    <TableRow key={invoice._id}>
                                        {columnVisibility.isVisible('invoiceNumber') && (
                                            <TableCell
                                                className="font-mono text-xs font-medium cursor-pointer hover:text-primary hover:underline"
                                                onClick={() => navigate(`/invoices/${invoice._id}`)}
                                            >
                                                {invoice.invoiceNumber}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('tenant') && (
                                            <TableCell>{invoice.tenantId?.fullName || '-'}</TableCell>
                                        )}
                                        {columnVisibility.isVisible('room') && (
                                            <TableCell>{invoice.roomId?.roomCode || '-'}</TableCell>
                                        )}
                                        {columnVisibility.isVisible('period') && (
                                            <TableCell>
                                                {invoice.billingPeriod?.month}/{invoice.billingPeriod?.year}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('totalAmount') && (
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(invoice.totalAmount)}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('paidAmount') && (
                                            <TableCell className="text-right text-green-600">
                                                {formatCurrency(invoice.paidAmount || 0)}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('remainingAmount') && (
                                            <TableCell className="text-right text-orange-600 font-medium">
                                                {formatCurrency(invoice.remainingAmount || 0)}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('dueDate') && (
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {isOverdue(invoice.dueDate, invoice.status) && (
                                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                                    )}
                                                    <span className={isOverdue(invoice.dueDate, invoice.status) ? 'text-red-500' : ''}>
                                                        {formatDate(invoice.dueDate)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('status') && (
                                            <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${invoice._id}`)} title={t('common.view')}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        setSelectedInvoice(invoice);
                                                        setIsPaymentOpen(true);
                                                    }} title={t('payments.record')} className="text-emerald-600 hover:text-emerald-700">
                                                        <CreditCard className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(invoice)} className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('invoices.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('invoices.deleteConfirm', { number: selectedInvoice?.invoiceNumber })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedInvoice && deleteMutation.mutate(selectedInvoice._id)}
                            disabled={deleteMutation.isPending}
                        >
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>



            {/* Record Payment Modal */}
            <RecordPaymentModal
                open={isPaymentOpen}
                onOpenChange={setIsPaymentOpen}
                invoice={selectedInvoice}
                onSuccess={() => {
                    setIsPaymentOpen(false);
                    setSelectedInvoice(null);
                }}
            />

        </div>
    );
}
