import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react';
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
import BuildingForm, { BuildingFormData } from '@/components/forms/BuildingForm';
import { formatCellValue } from '@/utils/tableUtils';
import { useDebounce } from '@/hooks/useDebounce';
import { useColumnVisibility, ColumnConfig } from '@/hooks/useColumnVisibility';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';

interface Address {
    street: string;
    ward: string;
    district: string;
    city: string;
}

interface Building {
    _id: string;
    name: string;
    code: string;
    address: Address;
    totalRooms: number;
    description?: string;
    isDeleted: boolean;
    createdAt: string;
}



const buildingsApi = {
    getAll: async (params: { page: number; limit: number; search?: string }) => {
        const response = await apiClient.get('/buildings', { params });
        return response.data;
    },
    create: async (data: BuildingFormData) => {
        const response = await apiClient.post('/buildings', data);
        return response.data;
    },
    update: async (id: string, data: Partial<BuildingFormData>) => {
        const response = await apiClient.put(`/buildings/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/buildings/${id}`);
        return response.data;
    },
};

export default function BuildingsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Column visibility configuration
    const columnConfig: ColumnConfig[] = [
        { id: 'name', label: t('buildings.name') },
        { id: 'code', label: t('buildings.code') },
        { id: 'address', label: t('buildings.address') },
        { id: 'totalRooms', label: t('buildings.totalRooms') },
    ];
    const columnVisibility = useColumnVisibility('buildings', columnConfig);

    // Debounce search term would be ideal, but for now passing directly
    const { data, isPending, error } = useQuery({
        queryKey: ['buildings', { page: currentPage, limit: pageSize, search: debouncedSearchTerm }],
        queryFn: () => buildingsApi.getAll({ page: currentPage, limit: pageSize, search: debouncedSearchTerm }),
    });

    console.log('VERSION: 1.0.2 - Fixed Map & V5 Pending');
    console.log('Buildings Data:', data);
    console.log('Query Error:', error);

    const buildings = Array.isArray(data?.data) ? data.data : [];
    const meta = data?.meta || { total: 0, totalPages: 1 };

    const createMutation = useMutation({
        mutationFn: buildingsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['buildings'] });
            setIsAddOpen(false);
            toast({ title: t('buildings.createSuccess') });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: t('buildings.createError'),
                description: error.response?.data?.message?.join(', ') || error.message
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<BuildingFormData> }) => {
            return buildingsApi.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['buildings'] });
            setIsEditOpen(false);
            setSelectedBuilding(null);
            toast({ title: t('buildings.updateSuccess') });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: t('buildings.updateError'),
                description: error.response?.data?.message?.join(', ') || error.message
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: buildingsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['buildings'] });
            setIsDeleteOpen(false);
            setSelectedBuilding(null);
            toast({ title: t('buildings.deleteSuccess') });
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.message;
            const isRoomsError = errorMessage?.includes('occupied rooms');

            toast({
                variant: 'destructive',
                title: isRoomsError ? t('buildings.deleteErrorHasRooms') : t('buildings.deleteError')
            });
        },
    });

    const handleEdit = (building: Building) => {
        setSelectedBuilding(building);
        setIsEditOpen(true);
    };

    const handleDelete = (building: Building) => {
        setSelectedBuilding(building);
        setIsDeleteOpen(true);
    };

    const formatAddress = (address: Address) => {
        if (!address) return '-';
        return [address.street, address.ward, address.district, address.city]
            .filter(Boolean)
            .join(', ');
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
                    <h1 className="text-3xl font-bold tracking-tight">{t('buildings.title')}</h1>
                    <p className="text-muted-foreground">{t('buildings.subtitle')}</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('buildings.add')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent
                        className="max-w-md"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                    >

                        <DialogHeader>
                            <DialogTitle>{t('buildings.addTitle')}</DialogTitle>
                            <DialogDescription>{t('buildings.addDescription')}</DialogDescription>
                        </DialogHeader>
                        <BuildingForm
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
                            <Building2 className="h-5 w-5" />
                            {t('buildings.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('buildings.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isPending ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {t('common.loading')}
                        </div>
                    ) : buildings.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {t('buildings.noData')}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('name') && <TableHead>{t('buildings.name')}</TableHead>}
                                    {columnVisibility.isVisible('code') && <TableHead>{t('buildings.code')}</TableHead>}
                                    {columnVisibility.isVisible('address') && <TableHead>{t('buildings.address')}</TableHead>}
                                    {columnVisibility.isVisible('totalRooms') && <TableHead className="text-center">{t('buildings.totalRooms')}</TableHead>}
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {buildings.map((building: Building) => (
                                    <TableRow key={building._id}>
                                        {columnVisibility.isVisible('name') && <TableCell className="font-medium">{formatCellValue(building.name)}</TableCell>}
                                        {columnVisibility.isVisible('code') && <TableCell>{formatCellValue(building.code)}</TableCell>}
                                        {columnVisibility.isVisible('address') && (
                                            <TableCell className="max-w-[300px] truncate">
                                                {formatCellValue(formatAddress(building.address))}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('totalRooms') && (
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{formatCellValue(building.totalRooms || 0)}</Badge>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(building)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(building)} className="text-destructive hover:text-destructive">
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
                    className="max-w-md"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('buildings.editTitle')}</DialogTitle>
                        <DialogDescription>{t('buildings.editDescription')}</DialogDescription>
                    </DialogHeader>
                    {selectedBuilding && (
                        <BuildingForm
                            defaultValues={{
                                name: selectedBuilding.name,
                                code: selectedBuilding.code,
                                address: selectedBuilding.address,
                                description: selectedBuilding.description || '',
                            }}
                            onSubmit={(data) =>
                                updateMutation.mutate({ id: selectedBuilding._id, data })
                            }
                            onCancel={() => setIsEditOpen(false)}
                            isSubmitting={updateMutation.isPending}
                            isEditing={true}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('buildings.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('buildings.deleteConfirm', { name: selectedBuilding?.name })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedBuilding && deleteMutation.mutate(selectedBuilding._id)}
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
