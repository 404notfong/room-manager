import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Wrench, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import ServiceForm, { ServiceFormData } from '@/components/forms/ServiceForm';
import { PriceTablePopover } from '@/components/PriceTablePopover';
import { useDebounce } from '@/hooks/useDebounce';
import { useColumnVisibility, ColumnConfig } from '@/hooks/useColumnVisibility';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';

interface PriceTier {
    fromValue: number;
    toValue: number;
    price: number;
}

interface Service {
    _id: string;
    code: string;
    name: string;
    unit: string;
    priceType: 'FIXED' | 'TABLE';
    fixedPrice: number;
    priceTiers: PriceTier[];
    buildingScope: 'ALL' | 'SPECIFIC';
    buildingIds: Array<{ _id: string; name: string }>;
    isActive: boolean;
    createdAt: string;
}

const servicesApi = {
    getAll: async (params: { page: number; limit: number; search?: string }) => {
        const response = await apiClient.get('/services', { params });
        return response.data;
    },
    create: async (data: ServiceFormData) => {
        const response = await apiClient.post('/services', data);
        return response.data;
    },
    update: async (id: string, data: Partial<ServiceFormData>) => {
        const response = await apiClient.put(`/services/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/services/${id}`);
        return response.data;
    },
};

export default function ServicesPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Column visibility configuration
    const columnConfig: ColumnConfig[] = [
        { id: 'name', label: t('services.name') },
        { id: 'code', label: t('services.code') },
        { id: 'unit', label: t('services.unit') },
        { id: 'price', label: t('services.price') },
        { id: 'scope', label: t('services.scope') },
        { id: 'status', label: t('common.status') },
    ];
    const columnVisibility = useColumnVisibility('services', columnConfig);

    const { data: servicesData, isLoading } = useQuery({
        queryKey: ['services', { page: currentPage, limit: pageSize, search: debouncedSearchTerm }],
        queryFn: () => servicesApi.getAll({
            page: currentPage,
            limit: pageSize,
            search: debouncedSearchTerm
        }),
    });

    const services: Service[] = Array.isArray(servicesData?.data) ? servicesData.data : [];
    const meta = servicesData?.meta || { total: 0, totalPages: 0 };

    const createMutation = useMutation({
        mutationFn: (data: ServiceFormData) => servicesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            setIsAddOpen(false);
            toast({ title: t('services.createSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('services.createError') });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ServiceFormData> }) =>
            servicesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            setIsEditOpen(false);
            setSelectedService(null);
            toast({ title: t('services.updateSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('services.updateError') });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: servicesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            setIsDeleteOpen(false);
            setSelectedService(null);
            toast({ title: t('services.deleteSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('services.deleteError') });
        },
    });

    const handleEdit = (service: Service) => {
        setSelectedService(service);
        setIsEditOpen(true);
    };

    const handleDelete = (service: Service) => {
        setSelectedService(service);
        setIsDeleteOpen(true);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    interface Building {
        _id: string;
        name: string;
    }

    const { data: buildings = [] } = useQuery({
        queryKey: ['buildings'],
        queryFn: async () => {
            const res = await apiClient.get('/buildings');
            return (res.data.data || []) as Building[];
        }
    });

    const getBuildingName = (idOrObj: string | { _id: string; name: string }) => {
        if (typeof idOrObj !== 'string') return idOrObj.name;
        return buildings.find((b: Building) => b._id === idOrObj)?.name || '...';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('services.title')}</h1>
                    <p className="text-muted-foreground">{t('services.subtitle')}</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('services.add')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent
                        className="max-w-2xl max-h-[90vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                    >

                        <DialogHeader>
                            <DialogTitle>{t('services.addTitle')}</DialogTitle>
                            <DialogDescription>{t('services.addDescription')}</DialogDescription>
                        </DialogHeader>
                        <ServiceForm
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
                            <Wrench className="h-5 w-5" />
                            {t('services.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('services.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                    ) : services.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('services.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('name') && <TableHead>{t('services.name')}</TableHead>}
                                    {columnVisibility.isVisible('code') && <TableHead>{t('services.code')}</TableHead>}
                                    {columnVisibility.isVisible('unit') && <TableHead>{t('services.unit')}</TableHead>}
                                    {columnVisibility.isVisible('price') && <TableHead className="text-right">{t('services.price')}</TableHead>}
                                    {columnVisibility.isVisible('scope') && <TableHead>{t('services.scope')}</TableHead>}
                                    {columnVisibility.isVisible('status') && <TableHead className="text-center">{t('common.status')}</TableHead>}
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {services.map((service: Service) => (
                                    <TableRow key={service._id}>
                                        {columnVisibility.isVisible('name') && <TableCell className="font-medium">{service.name}</TableCell>}
                                        {columnVisibility.isVisible('code') && <TableCell className="font-mono text-sm">{service.code}</TableCell>}
                                        {columnVisibility.isVisible('unit') && <TableCell>{service.unit}</TableCell>}
                                        {columnVisibility.isVisible('price') && (
                                            <TableCell className="text-right">
                                                {service.priceType === 'FIXED' ? (
                                                    formatPrice(service.fixedPrice)
                                                ) : (
                                                    <PriceTablePopover
                                                        shortTermPrices={service.priceTiers}
                                                        unitLabel={service.unit}
                                                    />
                                                )}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('scope') && (
                                            <TableCell>
                                                {service.buildingScope === 'ALL' ? (
                                                    <Badge variant="secondary">{t('services.allBuildings')}</Badge>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {service.buildingIds?.length > 0 ? (
                                                            <>
                                                                {service.buildingIds.slice(0, 3).map((b) => (
                                                                    <Badge key={typeof b === 'string' ? b : b._id} variant="outline" className="font-normal">
                                                                        {getBuildingName(b)}
                                                                    </Badge>
                                                                ))}
                                                                {service.buildingIds.length > 3 && (
                                                                    <Badge variant="secondary" className="font-normal text-xs">
                                                                        +{service.buildingIds.length - 3}
                                                                    </Badge>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">{t('services.noBuildings')}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('status') && (
                                            <TableCell className="text-center">
                                                <Badge variant={service.isActive ? 'default' : 'secondary'}>
                                                    {service.isActive ? t('common.active') : t('common.inactive')}
                                                </Badge>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(service)} className="text-destructive hover:text-destructive">
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
            < Dialog open={isEditOpen} onOpenChange={setIsEditOpen} >
                <DialogContent
                    className="max-w-2xl max-h-[90vh] overflow-y-auto"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('services.editTitle')}</DialogTitle>
                        <DialogDescription>{t('services.editDescription')}</DialogDescription>
                    </DialogHeader>
                    {selectedService && (
                        <ServiceForm
                            key={selectedService._id}
                            defaultValues={{
                                name: selectedService.name,
                                unit: selectedService.unit,
                                priceType: selectedService.priceType,
                                fixedPrice: selectedService.fixedPrice,
                                priceTiers: selectedService.priceTiers,
                                buildingScope: selectedService.buildingScope,
                                // Handle both populated (object) and unpopulated (string) buildingIds
                                buildingIds: selectedService.buildingIds?.map(b =>
                                    typeof b === 'string' ? b : b._id
                                ) || [],
                                isActive: selectedService.isActive,
                            }}
                            onSubmit={(data: ServiceFormData) =>
                                updateMutation.mutate({ id: selectedService._id, data })
                            }
                            onCancel={() => setIsEditOpen(false)}
                            isSubmitting={updateMutation.isPending}
                        />
                    )}
                </DialogContent>
            </Dialog >

            {/* Delete Dialog */}
            < Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} >
                <DialogContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('services.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('services.deleteConfirm', { name: selectedService?.name })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedService && deleteMutation.mutate(selectedService._id)}
                            disabled={deleteMutation.isPending}
                        >
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    );
}
