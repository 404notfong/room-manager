import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, DoorOpen, Droplets, Pencil, Plus, Search, Trash2, Zap } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { ColumnConfig, useColumnVisibility } from '@/hooks/useColumnVisibility';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';
import { useDebounce } from '@/hooks/useDebounce';
import { useBuildingStore } from '@/stores/buildingStore';
import Pagination from '@/components/Pagination';
import { PriceTablePopover } from '@/components/PriceTablePopover';
import { formatCellValue } from '@/utils/tableUtils';
import apiClient from '@/api/client';

interface ShortTermPriceTier {
    fromValue: number;
    toValue: number;
    price: number;
}

interface Room {
    _id: string;
    roomCode: string;
    roomName: string;
    buildingId: { _id: string; name: string };
    roomGroupId?: { _id: string; name: string };
    floor: number;
    area?: number;
    maxOccupancy?: number;
    status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'DEPOSITED';
    amenities: string[];
    description?: string;
    roomType: 'LONG_TERM' | 'SHORT_TERM';
    defaultElectricPrice?: number;
    defaultWaterPrice?: number;
    defaultRoomPrice?: number;
    defaultTermMonths?: number;
    shortTermPricingType?: 'HOURLY' | 'DAILY' | 'FIXED';
    hourlyPricingMode?: 'PER_HOUR' | 'TABLE';
    pricePerHour?: number;
    shortTermPrices?: ShortTermPriceTier[];
    priceTableType?: 'PROGRESSIVE' | 'FLAT';
    fixedPrice?: number;
    currentElectricIndex?: number;
    currentWaterIndex?: number;
    createdAt: string;
}

const roomsApi = {
    getAll: async (params: { page: number; limit: number; search?: string; buildingId?: string }) => {
        const response = await apiClient.get('/rooms', { params });
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await apiClient.put(`/rooms/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/rooms/${id}`);
        return response.data;
    },
};

export default function RoomsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const columnConfig: ColumnConfig[] = [
        { id: 'roomName', label: t('rooms.roomName') },
        { id: 'roomCode', label: t('rooms.roomCode') },
        { id: 'building', label: t('rooms.building') },
        { id: 'roomType', label: t('rooms.roomType') },
        { id: 'floor', label: t('rooms.floor') },
        { id: 'price', label: t('rooms.defaultRoomPrice') },
        { id: 'status', label: t('common.status') },
    ];
    const columnVisibility = useColumnVisibility('rooms', columnConfig);

    const { data: roomsData, isLoading } = useQuery({
        queryKey: ['rooms', { page: currentPage, limit: pageSize, search: debouncedSearchTerm, buildingId: selectedBuildingId }],
        queryFn: () => roomsApi.getAll({
            page: currentPage,
            limit: pageSize,
            search: debouncedSearchTerm,
            buildingId: selectedBuildingId || undefined
        }),
    });

    const rooms: Room[] = Array.isArray(roomsData?.data) ? roomsData.data : [];
    const meta = roomsData?.meta || { total: 0, totalPages: 0 };

    const deleteMutation = useMutation({
        mutationFn: roomsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setIsDeleteOpen(false);
            setSelectedRoom(null);
            toast({ title: t('rooms.deleteSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('rooms.deleteError') });
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'AVAILABLE' | 'MAINTENANCE' }) =>
            roomsApi.update(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            toast({ title: t('rooms.statusUpdated') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('rooms.updateError') });
        },
    });

    const handleQuickStatusToggle = (room: Room) => {
        if (room.status === 'OCCUPIED') return;
        const newStatus = room.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
        statusMutation.mutate({ id: room._id, status: newStatus });
    };

    const handleDelete = (room: Room) => {
        setSelectedRoom(room);
        setIsDeleteOpen(true);
    };

    const getStatusBadge = (room: Room) => {
        const isClickable = room.status !== 'OCCUPIED';
        const baseClasses = isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : '';
        switch (room.status) {
            case 'AVAILABLE':
                return <Badge className={`bg-green-500 ${baseClasses}`} onClick={() => isClickable && handleQuickStatusToggle(room)} title={isClickable ? t('rooms.clickToToggleStatus') : undefined}>{t('rooms.statusAvailable')}</Badge>;
            case 'OCCUPIED':
                return <Badge className="bg-blue-500">{t('rooms.statusOccupied')}</Badge>;
            case 'MAINTENANCE':
                return <Badge className={`bg-yellow-500 ${baseClasses}`} onClick={() => isClickable && handleQuickStatusToggle(room)} title={isClickable ? t('rooms.clickToToggleStatus') : undefined}>{t('rooms.statusMaintenance')}</Badge>;
            case 'DEPOSITED':
                return <Badge className={`bg-orange-500 ${baseClasses}`} onClick={() => isClickable && handleQuickStatusToggle(room)} title={isClickable ? t('rooms.clickToToggleStatus') : undefined}>{t('rooms.statusDeposited')}</Badge>;
            default:
                return <Badge variant="outline">{room.status}</Badge>;
        }
    };

    const getRoomTypeBadge = (roomType: string) => {
        if (roomType === 'LONG_TERM') {
            return <Badge variant="outline" className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-0">{t('rooms.roomTypeLongTerm')}</Badge>;
        }
        return <Badge variant="outline" className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 border-0">{t('rooms.roomTypeShortTerm')}</Badge>;
    };

    const formatCurrency = (amount: number | undefined) => {
        if (amount === undefined || amount === null) return '-';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getDisplayPrice = (room: Room) => {
        if (room.roomType === 'LONG_TERM') {
            return (
                <div className="flex flex-col gap-1 text-sm items-end">
                    <div className="font-medium whitespace-nowrap">
                        {formatCurrency(room.defaultRoomPrice)}
                        <span className="text-muted-foreground text-xs font-normal"> / {room.defaultTermMonths || 1} {t('common.months', 'tháng')}</span>
                    </div>
                    {(room.defaultElectricPrice || room.defaultWaterPrice) && (
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            {room.defaultElectricPrice && (
                                <span className="flex items-center gap-1" title={t('rooms.defaultElectricPrice')}>
                                    <Zap className="h-3 w-3" />
                                    {formatCurrency(room.defaultElectricPrice)}
                                </span>
                            )}
                            {room.defaultWaterPrice && (
                                <span className="flex items-center gap-1" title={t('rooms.defaultWaterPrice')}>
                                    <Droplets className="h-3 w-3" />
                                    {formatCurrency(room.defaultWaterPrice)}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            );
        } else if (room.shortTermPricingType === 'FIXED') {
            return formatCurrency(room.fixedPrice);
        } else if (room.shortTermPricingType === 'HOURLY' && room.hourlyPricingMode === 'PER_HOUR') {
            return formatCurrency(room.pricePerHour) + '/h';
        } else if (room.shortTermPricingType === 'HOURLY' && room.hourlyPricingMode === 'TABLE' && room.shortTermPrices) {
            return <PriceTablePopover shortTermPrices={room.shortTermPrices} pricingType="HOURLY" />;
        } else if (room.shortTermPricingType === 'DAILY' && room.shortTermPrices) {
            return <PriceTablePopover shortTermPrices={room.shortTermPrices} pricingType="DAILY" />;
        }
        return t('rooms.priceTable');
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('rooms.title')}</h1>
                    <p className="text-muted-foreground">{t('rooms.subtitle')}</p>
                </div>
                <Button onClick={() => navigate('/rooms/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('rooms.add')}
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
                            <DoorOpen className="h-5 w-5" />
                            {t('rooms.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('rooms.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                    ) : rooms.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('rooms.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('roomName') && <TableHead>{t('rooms.roomName')}</TableHead>}
                                    {columnVisibility.isVisible('roomCode') && <TableHead>{t('rooms.roomCode')}</TableHead>}
                                    {columnVisibility.isVisible('building') && <TableHead>{t('rooms.building')}</TableHead>}
                                    {columnVisibility.isVisible('roomType') && <TableHead className="text-center">{t('rooms.roomType')}</TableHead>}
                                    {columnVisibility.isVisible('floor') && <TableHead className="text-center">{t('rooms.floor')}</TableHead>}
                                    {columnVisibility.isVisible('price') && <TableHead className="text-right">{t('rooms.defaultRoomPrice')}</TableHead>}
                                    {columnVisibility.isVisible('status') && <TableHead className="text-center">{t('common.status')}</TableHead>}
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rooms.map((room) => (
                                    <TableRow key={room._id}>
                                        {columnVisibility.isVisible('roomName') && <TableCell className="font-medium">{formatCellValue(room.roomName)}</TableCell>}
                                        {columnVisibility.isVisible('roomCode') && <TableCell className="font-mono text-muted-foreground">{formatCellValue(room.roomCode)}</TableCell>}
                                        {columnVisibility.isVisible('building') && <TableCell>{formatCellValue(room.buildingId?.name)}</TableCell>}
                                        {columnVisibility.isVisible('roomType') && <TableCell className="text-center">{getRoomTypeBadge(room.roomType)}</TableCell>}
                                        {columnVisibility.isVisible('floor') && <TableCell className="text-center">{formatCellValue(room.floor)}</TableCell>}
                                        {columnVisibility.isVisible('price') && <TableCell className="text-right">{getDisplayPrice(room)}</TableCell>}
                                        {columnVisibility.isVisible('status') && <TableCell className="text-center">{getStatusBadge(room)}</TableCell>}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => navigate(`/rooms/${room._id}/edit`)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => navigate(`/rooms/new?duplicate=${room._id}`)} title={t('common.duplicate')}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(room)} className="text-destructive hover:text-destructive">
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
                        <DialogTitle>{t('rooms.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('rooms.deleteConfirm', { name: selectedRoom?.roomCode })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedRoom && deleteMutation.mutate(selectedRoom._id)}
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
