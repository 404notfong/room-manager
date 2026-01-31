import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useBuildingStore } from '@/stores/buildingStore';
import apiClient from '@/api/client';
import RoomGroupCollapse from './RoomGroupCollapse';
import { Skeleton } from '@/components/ui/skeleton';
import RoomForm, { RoomFormData } from '@/components/forms/RoomForm';

interface Room {
    _id: string;
    roomCode: string;
    roomName: string;
    floor: number;
    status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'DEPOSITED';
    roomType: 'LONG_TERM' | 'SHORT_TERM';
    defaultRoomPrice?: number;
    defaultTermMonths?: number;
    shortTermPricingType?: 'HOURLY' | 'DAILY' | 'FIXED';
    hourlyPricingMode?: 'PER_HOUR' | 'TABLE';
    pricePerHour?: number;
    fixedPrice?: number;
    shortTermPrices?: { fromValue: number; toValue: number; price: number }[];
    roomGroupId?: { _id: string; name: string; color?: string };
    activeContract?: {
        _id: string;
        tenantId?: { _id: string; fullName: string; phone?: string };
        endDate?: string;
        startDate?: string;
        contractCode?: string;
        contractType?: 'LONG_TERM' | 'SHORT_TERM';
        rentPrice?: number;
        shortTermPricingType?: string;
        hourlyPricingMode?: string;
        pricePerHour?: number;
        fixedPrice?: number;
        electricityPrice?: number;
        waterPrice?: number;
        depositAmount?: number;
        paymentCycle?: string;
        paymentCycleMonths?: number;
        paymentDueDay?: number;
        serviceCharges?: Array<{ name: string; amount: number; quantity?: number; isRecurring: boolean }>;
    };
}

interface RoomGroup {
    _id: string;
    name: string;
    color?: string;
    rooms: Room[];
}

interface RoomStatusOverviewProps {
    onCreateContract: (roomId: string) => void;
    onViewContract: (contractId: string) => void;
    onEditContract?: (contractId: string) => void;
    onActivateContract?: (contract: { _id: string; startDate: string; endDate?: string }) => void;
}

type StatusFilter = 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

const roomsApi = {
    getDashboard: async (params: {
        buildingId?: string;
        status?: string;
        search?: string;
        roomGroupIds?: string;
    }) => {
        const response = await apiClient.get('/rooms/dashboard', { params });
        return response.data;
    },
    updateStatus: async (id: string, status: string) => {
        const response = await apiClient.put(`/rooms/${id}`, { status });
        return response.data;
    },
    getOne: async (id: string) => {
        const response = await apiClient.get(`/rooms/${id}`);
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await apiClient.put(`/rooms/${id}`, data);
        return response.data;
    },
};

const roomGroupsApi = {
    getAll: async (buildingId?: string) => {
        const params = buildingId ? { buildingId, limit: 100 } : { limit: 100 };
        const response = await apiClient.get('/room-groups', { params });
        return response.data;
    },
};

export default function RoomStatusOverview({
    onCreateContract,
    onViewContract,
    onEditContract,
    onActivateContract
}: RoomStatusOverviewProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Edit Room State
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const debouncedSearch = useDebounce(searchTerm, 500);

    // Fetch dashboard rooms
    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['rooms-dashboard', {
            buildingId: selectedBuildingId,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            search: debouncedSearch,
            roomGroupIds: selectedGroupIds.length > 0 ? selectedGroupIds.join(',') : undefined,
        }],
        queryFn: () => roomsApi.getDashboard({
            buildingId: selectedBuildingId || undefined,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            search: debouncedSearch || undefined,
            roomGroupIds: selectedGroupIds.length > 0 ? selectedGroupIds.join(',') : undefined,
        }),
    });

    // Fetch room groups for filter
    const { data: roomGroupsData } = useQuery({
        queryKey: ['room-groups', selectedBuildingId],
        queryFn: () => roomGroupsApi.getAll(selectedBuildingId || undefined),
    });

    const roomGroups = roomGroupsData?.data || [];

    // Status toggle mutation
    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            roomsApi.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            toast({ title: t('rooms.statusUpdated') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('rooms.updateError') });
        },
    });

    // Update Room Mutation
    const updateRoomMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => roomsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            if (editingRoomId) {
                queryClient.invalidateQueries({ queryKey: ['room', editingRoomId] });
            }
            toast({ title: t('rooms.updateSuccess') });
            setIsEditModalOpen(false);
            setEditingRoomId(null);
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: t('rooms.updateError'),
                description: error.response?.data?.message
            });
        },
    });

    // Fetch room details for editing
    const { data: editingRoomData, isLoading: isLoadingRoom } = useQuery({
        queryKey: ['room', editingRoomId],
        queryFn: () => roomsApi.getOne(editingRoomId!),
        enabled: !!editingRoomId && isEditModalOpen,
    });

    const handleToggleStatus = (roomId: string, newStatus: 'AVAILABLE' | 'MAINTENANCE') => {
        statusMutation.mutate({ id: roomId, status: newStatus });
    };

    const handleToggleGroup = (groupId: string) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const clearGroupFilter = () => {
        setSelectedGroupIds([]);
    };

    const handleEditRoom = (roomId: string) => {
        setEditingRoomId(roomId);
        setIsEditModalOpen(true);
    };

    const handleUpdateRoom = (data: RoomFormData) => {
        if (!editingRoomId) return;
        // Strip read-only or non-updatable fields before sending
        const { buildingId, ...updateData } = data as any;

        // Also remove other potential metadata if they leak into RoomFormData
        delete updateData._id;
        delete updateData.roomCode;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        updateRoomMutation.mutate({ id: editingRoomId, data: updateData });
    };

    // Group rooms by roomGroupId
    const groupedRooms: RoomGroup[] = dashboardData?.groups || [];
    const ungroupedRooms: Room[] = dashboardData?.ungrouped || [];

    const statusTabs: { key: StatusFilter; label: string }[] = [
        { key: 'ALL', label: t('dashboard.allRooms') },
        { key: 'OCCUPIED', label: t('dashboard.occupied') },
        { key: 'AVAILABLE', label: t('dashboard.vacant') },
        { key: 'MAINTENANCE', label: t('dashboard.maintenance') },
    ];

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    {t('dashboard.roomOverview')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Filters Row - Responsive */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
                        {/* Status Tabs */}
                        <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto shrink-0 w-full md:w-auto">
                            {statusTabs.map((tab) => (
                                <Button
                                    key={tab.key}
                                    variant={statusFilter === tab.key ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setStatusFilter(tab.key)}
                                    className="text-xs sm:text-sm whitespace-nowrap flex-1 md:flex-none"
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </div>

                        {/* Search and Group Filter */}
                        <div className="flex w-full md:w-auto gap-2">
                            {/* Search */}
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('dashboard.searchRooms')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>

                            {/* Group Filter */}
                            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 px-3 border-dashed"
                                    >
                                        <Filter className="h-4 w-4 md:mr-2" />
                                        <span className="hidden md:inline truncate max-w-[100px]">
                                            {selectedGroupIds.length === 0
                                                ? t('dashboard.allGroups')
                                                : `${selectedGroupIds.length} ${t('dashboard.groupsSelected')}`
                                            }
                                        </span>
                                        {selectedGroupIds.length > 0 && (
                                            <Badge variant="secondary" className="ml-1.5 hidden md:flex h-5 px-1.5">
                                                {selectedGroupIds.length}
                                            </Badge>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0" align="end">
                                    <div className="p-2 border-b">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">
                                                {t('dashboard.filterByGroup')}
                                            </span>
                                            {selectedGroupIds.length > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={clearGroupFilter}
                                                    className="h-6 px-2 text-xs"
                                                >
                                                    <X className="h-3 w-3 mr-1" />
                                                    {t('common.clear')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                        {roomGroups.length === 0 ? (
                                            <div className="text-sm text-muted-foreground p-2 text-center">
                                                {t('roomGroups.noData')}
                                            </div>
                                        ) : (
                                            roomGroups.map((group: any) => (
                                                <label
                                                    key={group._id}
                                                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                                                >
                                                    <Checkbox
                                                        checked={selectedGroupIds.includes(group._id)}
                                                        onCheckedChange={() => handleToggleGroup(group._id)}
                                                    />
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {group.color && (
                                                            <div
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: group.color }}
                                                            />
                                                        )}
                                                        <span className="text-sm truncate">{group.name}</span>
                                                    </div>
                                                    {selectedGroupIds.includes(group._id) && (
                                                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                                    )}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Selected Groups Tags */}
                    {selectedGroupIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {selectedGroupIds.map(groupId => {
                                const group = roomGroups.find((g: any) => g._id === groupId);
                                if (!group) return null;
                                return (
                                    <Badge
                                        key={groupId}
                                        variant="secondary"
                                        className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                        onClick={() => handleToggleGroup(groupId)}
                                    >
                                        {group.color && (
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: group.color }}
                                            />
                                        )}
                                        {group.name}
                                        <X className="h-3 w-3" />
                                    </Badge>
                                );
                            })}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearGroupFilter}
                                className="h-6 px-2 text-xs"
                            >
                                {t('common.clearAll')}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Room Groups */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm">
                                <div className="flex items-center gap-2 p-4 border-b bg-muted/40">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-5 w-32" />
                                </div>
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {[1, 2, 3, 4].map((j) => (
                                        <Skeleton key={j} className="h-[140px] w-full rounded-lg" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedRooms.map((group) => (
                            <RoomGroupCollapse
                                key={group._id}
                                groupName={group.name}
                                groupColor={group.color}
                                rooms={group.rooms}
                                onCreateContract={onCreateContract}
                                onViewContract={onViewContract}
                                onEdit={handleEditRoom}
                                onToggleStatus={handleToggleStatus}
                                isTogglingStatus={statusMutation.isPending}
                                onEditContract={onEditContract}
                                onActivateContract={onActivateContract}
                            />
                        ))}

                        {ungroupedRooms.length > 0 && (
                            <RoomGroupCollapse
                                groupName={t('dashboard.ungrouped')}
                                rooms={ungroupedRooms}
                                onCreateContract={onCreateContract}
                                onViewContract={onViewContract}
                                onEdit={handleEditRoom}
                                onToggleStatus={handleToggleStatus}
                                isTogglingStatus={statusMutation.isPending}
                                onEditContract={onEditContract}
                                onActivateContract={onActivateContract}
                            />
                        )}

                        {groupedRooms.length === 0 && ungroupedRooms.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                {t('rooms.noData')}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Edit Room Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={(open) => {
                setIsEditModalOpen(open);
                if (!open) setEditingRoomId(null);
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>{t('rooms.titleEdit')}</DialogTitle>
                    </DialogHeader>
                    {isLoadingRoom ? (
                        <div className="p-8 space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : (
                        editingRoomData && (
                            <RoomForm
                                defaultValues={editingRoomData}
                                onSubmit={handleUpdateRoom}
                                onCancel={() => setIsEditModalOpen(false)}
                                isSubmitting={updateRoomMutation.isPending}
                                isEditing={true}
                                roomCode={editingRoomData.roomCode}
                                currentStatus={editingRoomData.status}
                            />
                        )
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
