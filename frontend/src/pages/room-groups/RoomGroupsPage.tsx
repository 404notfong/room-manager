import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Layers, Search } from 'lucide-react';
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
import RoomGroupForm, { RoomGroupFormData } from '@/components/forms/RoomGroupForm';
import { useBuildingStore } from '@/stores/buildingStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useColumnVisibility, ColumnConfig } from '@/hooks/useColumnVisibility';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';

interface RoomGroup {
    _id: string;
    buildingId: string | { _id: string; name: string };
    name: string;
    description?: string;
    color?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
}

const roomGroupsApi = {
    getAll: async (params: { page: number; limit: number; search?: string; buildingId?: string | null }) => {
        const response = await apiClient.get('/room-groups', { params });
        return response.data;
    },
    create: async (data: RoomGroupFormData) => {
        // Clean up empty strings for optional fields
        const cleanData = {
            ...data,
            description: data.description || undefined,
            color: data.color || undefined,
        };
        const response = await apiClient.post('/room-groups', cleanData);
        return response.data;
    },
    update: async (id: string, data: Partial<RoomGroupFormData>) => {
        // Clean up empty strings for optional fields
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { buildingId, ...rest } = data;
        const cleanData = {
            ...rest,
            description: rest.description || undefined,
            color: rest.color || undefined,
        };
        const response = await apiClient.put(`/room-groups/${id}`, cleanData);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/room-groups/${id}`);
        return response.data;
    },
};



export default function RoomGroupsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<RoomGroup | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Column visibility configuration
    const columnConfig: ColumnConfig[] = [
        { id: 'name', label: t('roomGroups.name') },
        { id: 'code', label: t('roomGroups.code') },
        { id: 'description', label: t('roomGroups.description') },
        { id: 'sortOrder', label: t('roomGroups.sortOrder') },
        { id: 'status', label: t('common.status') },
    ];
    const columnVisibility = useColumnVisibility('roomGroups', columnConfig);

    const { data: roomGroupsData, isLoading } = useQuery({
        queryKey: ['room-groups', { buildingId: selectedBuildingId, page: currentPage, limit: pageSize, search: debouncedSearchTerm }],
        queryFn: () => roomGroupsApi.getAll({
            buildingId: selectedBuildingId || undefined,
            page: currentPage,
            limit: pageSize,
            search: debouncedSearchTerm
        }),
    });

    const roomGroups: RoomGroup[] = Array.isArray(roomGroupsData?.data) ? roomGroupsData.data : [];
    const meta = roomGroupsData?.meta || { total: 0, totalPages: 0 };

    const createMutation = useMutation({
        mutationFn: (data: RoomGroupFormData) => roomGroupsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['room-groups'] });
            setIsAddOpen(false);
            toast({ title: t('roomGroups.createSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('roomGroups.createError') });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<RoomGroupFormData> }) =>
            roomGroupsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['room-groups'] });
            setIsEditOpen(false);
            setSelectedGroup(null);
            toast({ title: t('roomGroups.updateSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('roomGroups.updateError') });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: roomGroupsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['room-groups'] });
            setIsDeleteOpen(false);
            setSelectedGroup(null);
            toast({ title: t('roomGroups.deleteSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('roomGroups.deleteError') });
        },
    });

    const handleEdit = (group: RoomGroup) => {
        setSelectedGroup(group);
        setIsEditOpen(true);
    };

    const handleDelete = (group: RoomGroup) => {
        setSelectedGroup(group);
        setIsDeleteOpen(true);
    };

    const getColorBadge = (color: string) => {
        const colorClasses: Record<string, string> = {
            red: 'bg-red-500',
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            yellow: 'bg-yellow-500',
            purple: 'bg-purple-500',
            pink: 'bg-pink-500',
            orange: 'bg-orange-500',
            gray: 'bg-gray-500',
        };
        return colorClasses[color] || 'bg-gray-500';
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
                    <h1 className="text-3xl font-bold tracking-tight">{t('roomGroups.title')}</h1>
                    <p className="text-muted-foreground">{t('roomGroups.subtitle')}</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('roomGroups.add')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                    >

                        <DialogHeader>
                            <DialogTitle>{t('roomGroups.addTitle')}</DialogTitle>
                            <DialogDescription>{t('roomGroups.addDescription')}</DialogDescription>
                        </DialogHeader>
                        <RoomGroupForm
                            onSubmit={(data) => createMutation.mutate(data)}
                            onCancel={() => setIsAddOpen(false)}
                            isSubmitting={createMutation.isPending}
                            preselectedBuildingId={selectedBuildingId}
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
                            <Layers className="h-5 w-5" />
                            {t('roomGroups.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('roomGroups.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                    ) : roomGroups.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('roomGroups.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('name') && <TableHead>{t('roomGroups.name')}</TableHead>}
                                    {columnVisibility.isVisible('code') && <TableHead>{t('roomGroups.code')}</TableHead>}
                                    {columnVisibility.isVisible('description') && <TableHead>{t('roomGroups.description')}</TableHead>}
                                    {columnVisibility.isVisible('sortOrder') && <TableHead className="text-center">{t('roomGroups.sortOrder')}</TableHead>}
                                    {columnVisibility.isVisible('status') && <TableHead className="text-center">{t('common.status')}</TableHead>}
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roomGroups.map((group) => (
                                    <TableRow key={group._id}>
                                        {columnVisibility.isVisible('name') && (
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-6 h-6 rounded-full shrink-0 ${getColorBadge(group.color || 'gray')}`} />
                                                    <span className="font-medium">{group.name}</span>
                                                </div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('code') && <TableCell className="font-mono text-sm">{(group as any).code}</TableCell>}
                                        {columnVisibility.isVisible('description') && (
                                            <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                                {group.description || '-'}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('sortOrder') && <TableCell className="text-center">{group.sortOrder}</TableCell>}
                                        {columnVisibility.isVisible('status') && (
                                            <TableCell className="text-center">
                                                <Badge variant={group.isActive ? 'default' : 'secondary'}>
                                                    {group.isActive ? t('common.active') : t('common.inactive')}
                                                </Badge>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(group)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(group)} className="text-destructive hover:text-destructive">
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
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >

                    <DialogHeader>
                        <DialogTitle>{t('roomGroups.editTitle')}</DialogTitle>
                        <DialogDescription>{t('roomGroups.editDescription')}</DialogDescription>
                    </DialogHeader>
                    {selectedGroup && (
                        <RoomGroupForm
                            defaultValues={{
                                buildingId: typeof selectedGroup.buildingId === 'object' ? selectedGroup.buildingId._id : selectedGroup.buildingId,
                                name: selectedGroup.name,
                                description: selectedGroup.description,
                                color: selectedGroup.color,
                                sortOrder: selectedGroup.sortOrder,
                                isActive: selectedGroup.isActive,
                            }}
                            onSubmit={(data) =>
                                updateMutation.mutate({ id: selectedGroup._id, data })
                            }
                            onCancel={() => setIsEditOpen(false)}
                            isSubmitting={updateMutation.isPending}
                            isEditing
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
                        <DialogTitle>{t('roomGroups.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('roomGroups.deleteConfirm', { name: selectedGroup?.name })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedGroup && deleteMutation.mutate(selectedGroup._id)}
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
