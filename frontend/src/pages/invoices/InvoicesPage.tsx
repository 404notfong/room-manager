import apiClient from '@/api/client';
import ContractSelectModal from '@/components/ContractSelectModal';
import CreateInvoiceModal from '@/components/CreateInvoiceModal';
import CreateShortTermInvoiceModal from '@/components/CreateShortTermInvoiceModal';
import InvoiceViewModal from '@/components/InvoiceViewModal';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeletons/TableSkeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useBuildingStore } from '@/stores/buildingStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Eye, MoreHorizontal, Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    createdAt: string;
}

const invoicesApi = {
    getAll: async (): Promise<Invoice[]> => {
        const response = await apiClient.get('/invoices');
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/invoices/${id}`);
        return response.data;
    },
};

export default function InvoicesPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Contract selection & invoice creation states
    const [isSelectContractOpen, setIsSelectContractOpen] = useState(false);
    const [selectedContract, setSelectedContract] = useState<any>(null);
    const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
    const [isCreateShortTermInvoiceOpen, setIsCreateShortTermInvoiceOpen] = useState(false);

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: invoicesApi.getAll,
    });

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

    const handleContractSelected = (contract: any) => {
        setSelectedContract(contract);
        const type = contract.roomType || contract.contractType;
        if (type === 'SHORT_TERM') {
            setIsCreateShortTermInvoiceOpen(true);
        } else {
            setIsCreateInvoiceOpen(true);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-green-500 text-[#F8FAFC] hover:bg-green-600">{t('invoices.statusPaid')}</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500 text-[#F8FAFC] hover:bg-yellow-600">{t('invoices.statusPending')}</Badge>;
            case 'overdue':
                return <Badge variant="destructive">{t('invoices.statusOverdue')}</Badge>;
            case 'cancelled':
                return <Badge variant="secondary">{t('invoices.statusCancelled')}</Badge>;
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
        return status === 'pending' && new Date(dueDate) < new Date();
    };

    // Filter by selected building first, then by search
    const buildingFilteredInvoices = selectedBuildingId
        ? invoices.filter(invoice => {
            const buildingId = typeof invoice.roomId?.buildingId === 'object'
                ? (invoice.roomId.buildingId as any)?._id
                : invoice.roomId?.buildingId;
            return buildingId === selectedBuildingId;
        })
        : invoices;

    const filteredInvoices = buildingFilteredInvoices.filter(
        (invoice) =>
            invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.tenantId?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.roomId?.roomCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination
    const totalPages = Math.ceil(filteredInvoices.length / pageSize);
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredInvoices.slice(start, start + pageSize);
    }, [filteredInvoices, currentPage, pageSize]);

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
                <Button onClick={() => setIsSelectContractOpen(true)}>
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
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        {t('invoices.list')}
                    </CardTitle>
                    <CardDescription>
                        {t('invoices.totalCount', { count: filteredInvoices.length })}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <TableSkeleton columns={9} />
                    ) : filteredInvoices.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('invoices.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('invoices.invoiceNumber')}</TableHead>
                                    <TableHead>{t('invoices.tenant')}</TableHead>
                                    <TableHead>{t('invoices.room')}</TableHead>
                                    <TableHead>{t('invoices.period')}</TableHead>
                                    <TableHead className="text-right">{t('invoices.totalAmount')}</TableHead>
                                    <TableHead className="text-right">{t('invoices.paidAmount')}</TableHead>
                                    <TableHead className="text-right">{t('invoices.remainingAmount')}</TableHead>
                                    <TableHead>{t('invoices.dueDate')}</TableHead>
                                    <TableHead className="text-center">{t('common.status')}</TableHead>
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedInvoices.map((invoice) => (
                                    <TableRow 
                                        key={invoice._id}
                                        className="cursor-pointer hover:bg-slate-50"
                                        onClick={() => {
                                            setSelectedInvoice(invoice);
                                            setIsViewOpen(true);
                                        }}
                                    >
                                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                        <TableCell>{invoice.tenantId?.fullName || '-'}</TableCell>
                                        <TableCell>{invoice.roomId?.roomCode || '-'}</TableCell>
                                        <TableCell>
                                            {invoice.billingPeriod?.month}/{invoice.billingPeriod?.year}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(invoice.totalAmount)}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600">
                                            {formatCurrency(invoice.paidAmount || 0)}
                                        </TableCell>
                                        <TableCell className="text-right text-orange-600 font-medium">
                                            {formatCurrency(invoice.remainingAmount || 0)}
                                        </TableCell>
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
                                        <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedInvoice(invoice);
                                                        setIsViewOpen(true);
                                                    }}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        {t('common.view')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        {t('common.edit')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(invoice);
                                                    }} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {t('common.delete')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {filteredInvoices.length > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            totalItems={filteredInvoices.length}
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

            {/* View Invoice Modal */}
            <InvoiceViewModal
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                invoice={selectedInvoice}
                onRecordPayment={() => {
                    setIsViewOpen(false);
                    setIsPaymentOpen(true);
                }}
            />

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

            {/* Contract Selection Modal */}
            <ContractSelectModal
                open={isSelectContractOpen}
                onOpenChange={setIsSelectContractOpen}
                onSelect={handleContractSelected}
            />

            {/* Create Invoice Modal (Long-term) */}
            <CreateInvoiceModal
                open={isCreateInvoiceOpen}
                onOpenChange={setIsCreateInvoiceOpen}
                contract={selectedContract}
                room={selectedContract?.roomId}
                onSuccess={() => {
                    setIsCreateInvoiceOpen(false);
                    setSelectedContract(null);
                    queryClient.invalidateQueries({ queryKey: ['invoices'] });
                }}
            />

            {/* Create Short-Term Invoice Modal */}
            <CreateShortTermInvoiceModal
                open={isCreateShortTermInvoiceOpen}
                onOpenChange={setIsCreateShortTermInvoiceOpen}
                contract={selectedContract}
                room={selectedContract?.roomId}
                onSuccess={() => {
                    setIsCreateShortTermInvoiceOpen(false);
                    setSelectedContract(null);
                    queryClient.invalidateQueries({ queryKey: ['invoices'] });
                }}
            />
        </div>
    );
}
