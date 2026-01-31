import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Users, Search, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import Pagination from '@/components/Pagination';
import TenantForm, { TenantFormData } from '@/components/forms/TenantForm';
import { useDebounce } from '@/hooks/useDebounce';
import { useColumnVisibility, ColumnConfig } from '@/hooks/useColumnVisibility';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';
import { formatPhoneNumber } from '@/lib/utils';

interface Tenant {
    _id: string;
    code: string;
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    dateOfBirth?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    address?: string;
    occupation?: string;
    // Map emergency contact
    emergencyContact?: {
        name?: string;
        phone?: string;
        relationship?: string;
    };
    status: 'RENTING' | 'ACTIVE' | 'CLOSED' | 'DEPOSITED';
    createdAt: string;
}

const tenantsApi = {
    getAll: async (params: { page: number; limit: number; search?: string }) => {
        const response = await apiClient.get('/tenants', { params });
        return response.data;
    },
    create: async (data: TenantFormData) => {
        // Map frontend fields to backend fields
        const backendData = {
            fullName: data.fullName,
            idCard: data.idNumber, // Backend uses idCard, not idNumber
            phone: data.phone,
            email: data.email || undefined,
            dateOfBirth: data.dateOfBirth || undefined,
            gender: data.gender || undefined,
            permanentAddress: data.address || undefined,
            occupation: data.occupation || undefined,
            status: data.status || undefined,
            emergencyContact: data.emergencyContact || undefined,
        };
        const response = await apiClient.post('/tenants', backendData);
        return response.data;
    },
    update: async (id: string, data: Partial<TenantFormData>) => {
        // Map frontend fields to backend fields
        const backendData: any = {};
        if (data.fullName) backendData.fullName = data.fullName;
        if (data.phone) backendData.phone = data.phone;
        if (data.email) backendData.email = data.email;
        if (data.idNumber) backendData.idCard = data.idNumber;
        if (data.dateOfBirth) backendData.dateOfBirth = data.dateOfBirth;
        if (data.gender) backendData.gender = data.gender;
        if (data.occupation) backendData.occupation = data.occupation;
        if (data.status) backendData.status = data.status;
        if (data.emergencyContact) backendData.emergencyContact = data.emergencyContact;
        if (data.address) backendData.permanentAddress = data.address;

        const response = await apiClient.put(`/tenants/${id}`, backendData);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/tenants/${id}`);
        return response.data;
    },
};

export default function TenantsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Column visibility configuration
    const columnConfig: ColumnConfig[] = [
        { id: 'fullName', label: t('tenants.fullName') },
        { id: 'code', label: t('tenants.code') },
        { id: 'contact', label: t('tenants.contact') },
        { id: 'idNumber', label: t('tenants.idNumber') },
        { id: 'status', label: t('common.status') },
        { id: 'createdAt', label: t('tenants.createdAt'), defaultVisible: false },
    ];
    const columnVisibility = useColumnVisibility('tenants', columnConfig);

    const { data: tenantsData, isLoading } = useQuery({
        queryKey: ['tenants', { page: currentPage, limit: pageSize, search: debouncedSearchTerm }],
        queryFn: () => tenantsApi.getAll({ page: currentPage, limit: pageSize, search: debouncedSearchTerm }),
    });

    const tenants: Tenant[] = (Array.isArray(tenantsData?.data) ? tenantsData.data : []).map((t: any) => ({
        ...t,
        idNumber: t.idCard,
        address: t.permanentAddress,
    }));
    const meta = tenantsData?.meta || { total: 0, totalPages: 0 };

    const createMutation = useMutation({
        mutationFn: tenantsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setIsAddOpen(false);
            toast({ title: t('tenants.createSuccess') });
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message;
            if (message === 'PHONE_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.phoneExistsError') });
            } else if (message === 'ID_CARD_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.idCardExistsError') });
            } else {
                toast({ variant: 'destructive', title: t('tenants.createError') });
            }
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<TenantFormData> }) =>
            tenantsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setIsEditOpen(false);
            setSelectedTenant(null);
            toast({ title: t('tenants.updateSuccess') });
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message;
            if (message === 'PHONE_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.phoneExistsError') });
            } else if (message === 'ID_CARD_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.idCardExistsError') });
            } else {
                toast({ variant: 'destructive', title: t('tenants.updateError') });
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: tenantsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setIsDeleteOpen(false);
            setSelectedTenant(null);
            toast({ title: t('tenants.deleteSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('tenants.deleteError') });
        },
    });

    const handleEdit = (tenant: Tenant) => {
        setSelectedTenant(tenant);
        setIsEditOpen(true);
    };

    const handleDelete = (tenant: Tenant) => {
        setSelectedTenant(tenant);
        setIsDeleteOpen(true);
    };

    const getInitials = (name: string) => {
        return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('tenants.title')}</h1>
                    <p className="text-muted-foreground">{t('tenants.subtitle')}</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('tenants.add')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent
                        className="max-w-2xl"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                    >

                        <DialogHeader>
                            <DialogTitle>{t('tenants.addTitle')}</DialogTitle>
                            <DialogDescription>{t('tenants.addDescription')}</DialogDescription>
                        </DialogHeader>
                        <TenantForm
                            onSubmit={(data) => createMutation.mutate(data)}
                            onCancel={() => setIsAddOpen(false)}
                            isSubmitting={createMutation.isPending}
                        />
                    </DialogContent>
                </Dialog>
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
                            <Users className="h-5 w-5" />
                            {t('tenants.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('tenants.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                    ) : tenants.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('tenants.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('fullName') && <TableHead>{t('tenants.fullName')}</TableHead>}
                                    {columnVisibility.isVisible('code') && <TableHead>{t('tenants.code')}</TableHead>}
                                    {columnVisibility.isVisible('contact') && <TableHead>{t('tenants.contact')}</TableHead>}
                                    {columnVisibility.isVisible('idNumber') && <TableHead>{t('tenants.idNumber')}</TableHead>}
                                    {columnVisibility.isVisible('status') && <TableHead className="text-center">{t('common.status')}</TableHead>}
                                    {columnVisibility.isVisible('createdAt') && <TableHead>{t('tenants.createdAt')}</TableHead>}
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants.map((tenant) => (
                                    <TableRow key={tenant._id}>
                                        {columnVisibility.isVisible('fullName') && (
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                                            {getInitials(tenant.fullName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{tenant.fullName}</span>
                                                </div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('code') && <TableCell className="font-mono text-sm">{tenant.code}</TableCell>}
                                        {columnVisibility.isVisible('contact') && (
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Phone className="h-3 w-3" />
                                                        {formatPhoneNumber(tenant.phone)}
                                                    </div>
                                                    {tenant.email && (
                                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                            <Mail className="h-3 w-3" />
                                                            {tenant.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('idNumber') && <TableCell>{tenant.idNumber}</TableCell>}
                                        {columnVisibility.isVisible('status') && (
                                            <TableCell className="text-center">
                                                <Badge
                                                    className={
                                                        tenant.status === 'RENTING' ? 'bg-blue-500 hover:bg-blue-600' :
                                                            tenant.status === 'ACTIVE' ? 'bg-green-500 hover:bg-green-600' :
                                                                tenant.status === 'DEPOSITED' ? 'bg-orange-500 hover:bg-orange-600' :
                                                                    'bg-gray-500 hover:bg-gray-600'
                                                    }
                                                >
                                                    {tenant.status === 'RENTING' ? t('tenants.statusRenting') :
                                                        tenant.status === 'ACTIVE' ? t('tenants.statusActive') :
                                                            tenant.status === 'DEPOSITED' ? t('tenants.statusDeposited') : t('tenants.statusClosed')}
                                                </Badge>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('createdAt') && (
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(tenant.createdAt).toLocaleDateString()}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(tenant)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(tenant)} className="text-destructive hover:text-destructive">
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

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent
                    className="max-w-2xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('tenants.editTitle')}</DialogTitle>
                        <DialogDescription>{t('tenants.editDescription')}</DialogDescription>
                    </DialogHeader>
                    {selectedTenant && (
                        <TenantForm
                            key={selectedTenant._id}
                            defaultValues={{
                                code: selectedTenant.code,
                                fullName: selectedTenant.fullName,
                                email: selectedTenant.email,
                                phone: selectedTenant.phone,
                                idNumber: selectedTenant.idNumber,
                                dateOfBirth: selectedTenant.dateOfBirth ? selectedTenant.dateOfBirth.split('T')[0] : '',
                                gender: selectedTenant.gender,
                                address: selectedTenant.address,
                                occupation: selectedTenant.occupation,
                                status: selectedTenant.status,
                                emergencyContact: selectedTenant.emergencyContact,
                            }}
                            onSubmit={(data) =>
                                updateMutation.mutate({ id: selectedTenant._id, data })
                            }
                            onCancel={() => setIsEditOpen(false)}
                            isSubmitting={updateMutation.isPending}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('tenants.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('tenants.deleteConfirm', { name: selectedTenant?.fullName })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedTenant && deleteMutation.mutate(selectedTenant._id)}
                            disabled={deleteMutation.isPending}
                        >
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
