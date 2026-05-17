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
import { formatCellValue } from '@/utils/tableUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
    delete: async (id: string) => {
        const response = await apiClient.delete(`/buildings/${id}`);
        return response.data;
    },
};

export default function BuildingsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const columnConfig: ColumnConfig[] = [
        { id: 'name', label: t('buildings.name') },
        { id: 'code', label: t('buildings.code') },
        { id: 'address', label: t('buildings.address') },
        { id: 'totalRooms', label: t('buildings.totalRooms') },
    ];
    const columnVisibility = useColumnVisibility('buildings', columnConfig);

    const { data, isPending } = useQuery({
        queryKey: ['buildings', { page: currentPage, limit: pageSize, search: debouncedSearchTerm }],
        queryFn: () => buildingsApi.getAll({ page: currentPage, limit: pageSize, search: debouncedSearchTerm }),
    });

    const buildings = Array.isArray(data?.data) ? data.data : [];
    const meta = data?.meta || { total: 0, totalPages: 1 };

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

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('buildings.title')}</h1>
                    <p className="text-muted-foreground">{t('buildings.subtitle')}</p>
                </div>
                <Button onClick={() => navigate('/buildings/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('buildings.add')}
                </Button>
            </div>

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
                        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                    ) : buildings.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('buildings.noData')}</div>
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
                                                <Button variant="ghost" size="icon" onClick={() => navigate(`/buildings/${building._id}/edit`)}>
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
