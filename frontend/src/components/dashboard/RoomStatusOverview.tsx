import apiClient from '@/api/client';
import RoomForm, { RoomFormData } from '@/components/forms/RoomForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useBuildingStore } from '@/stores/buildingStore';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Filter, GripVertical, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RoomCard from './RoomCard';
import RoomGroupCollapse from './RoomGroupCollapse';

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

type StatusFilter = 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'DEPOSITED';

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

// Reorder rooms API
const reorderRoomsApi = async (items: { roomId: string; roomGroupId?: string | null; sortOrder: number }[]) => {
    const response = await apiClient.patch('/rooms/reorder', { items });
    return response.data;
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

    // Reorder Rooms Mutation
    const reorderMutation = useMutation({
        mutationFn: reorderRoomsApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] });
            toast({ title: t('rooms.reorderSuccess', 'Đã sắp xếp lại phòng') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('rooms.reorderError', 'Lỗi khi sắp xếp phòng') });
        },
    });

    // Arrange mode state
    const [isArrangeMode, setIsArrangeMode] = useState(false);
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Minimum drag distance before activation
            },
        })
    );

    // Find room by ID across all groups
    const findRoomById = (roomId: string): Room | undefined => {
        for (const group of groupedRooms) {
            const found = group.rooms.find(r => r._id === roomId);
            if (found) return found;
        }
        return ungroupedRooms.find(r => r._id === roomId);
    };

    const activeRoom = activeRoomId ? findRoomById(activeRoomId) : null;

    // Handle drag start
    const handleDragStart = (event: DragStartEvent) => {
        setActiveRoomId(event.active.id as string);
    };

    // Handle drag end
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveRoomId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        // Find source group
        let sourceGroup: RoomGroup | null = null;
        let sourceRooms: Room[] = [];
        
        for (const group of groupedRooms) {
            if (group.rooms.find(r => r._id === activeId)) {
                sourceGroup = group;
                sourceRooms = group.rooms;
                break;
            }
        }
        if (!sourceGroup && ungroupedRooms.find(r => r._id === activeId)) {
            sourceRooms = ungroupedRooms;
        }

        // Find destination (could be a room in same/different group, or a group droppable)
        let destGroup: RoomGroup | null = null;
        let destRooms: Room[] = [];
        
        for (const group of groupedRooms) {
            if (group._id === overId || group.rooms.find(r => r._id === overId)) {
                destGroup = group;
                destRooms = group.rooms;
                break;
            }
        }
        if (!destGroup && (overId === 'ungrouped' || ungroupedRooms.find(r => r._id === overId))) {
            destRooms = ungroupedRooms;
        }

        // Calculate new order
        const oldIndex = sourceRooms.findIndex(r => r._id === activeId);
        const newIndex = destRooms.findIndex(r => r._id === overId);

        if (sourceGroup?._id === destGroup?._id || (!sourceGroup && !destGroup)) {
            // Same group - just reorder
            const newOrder = arrayMove(sourceRooms, oldIndex, newIndex >= 0 ? newIndex : sourceRooms.length);
            const updates = newOrder.map((room, idx) => ({
                roomId: room._id,
                sortOrder: idx,
            }));
            reorderMutation.mutate(updates);
        } else {
            // Different group - move to new group
            const updates = [{
                roomId: activeId,
                roomGroupId: destGroup?._id || null,
                sortOrder: newIndex >= 0 ? newIndex : destRooms.length,
            }];
            reorderMutation.mutate(updates);
        }
    };

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

    // Transform raw API data to match RoomForm expected format (same as RoomsPage)
    const getEditDefaultValues = (room: any): Partial<RoomFormData> => {
        return {
            buildingId: typeof room.buildingId === 'object' ? room.buildingId._id : room.buildingId,
            roomName: room.roomName,
            floor: room.floor,
            area: room.area,
            maxOccupancy: room.maxOccupancy,
            status: room.status,
            description: room.description,
            roomGroupId: room.roomGroupId ? (typeof room.roomGroupId === 'object' ? room.roomGroupId._id : room.roomGroupId) : undefined,
            roomType: room.roomType || 'LONG_TERM',
            defaultElectricPrice: room.defaultElectricPrice,
            defaultWaterPrice: room.defaultWaterPrice,
            defaultRoomPrice: room.defaultRoomPrice,
            defaultTermMonths: room.defaultTermMonths,
            shortTermPricingType: room.shortTermPricingType,
            hourlyPricingMode: room.hourlyPricingMode,
            pricePerHour: room.pricePerHour,
            shortTermPrices: (!room.shortTermPrices || room.shortTermPrices.length === 0)
                ? [
                    { fromValue: 0, toValue: 0, price: 0 },
                    { fromValue: 0, toValue: -1, price: 0 }
                ]
                : room.shortTermPrices,
            priceTableType: room.priceTableType || 'PROGRESSIVE',
            fixedPrice: room.fixedPrice,
            currentElectricIndex: room.currentElectricIndex || 0,
            currentWaterIndex: room.currentWaterIndex || 0,
        };
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
        { key: 'DEPOSITED', label: t('dashboard.deposited') },
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
                    <>
                        {/* Arrange Mode Toggle */}
                        <div className="flex justify-end mb-2">
                            <Button
                                variant={isArrangeMode ? "default" : "outline"}
                                size="sm"
                                onClick={() => setIsArrangeMode(!isArrangeMode)}
                                className="gap-2"
                            >
                                <GripVertical className="h-4 w-4" />
                                {isArrangeMode ? t('dashboard.doneArranging', 'Xong') : t('dashboard.arrangeRooms', 'Sắp xếp')}
                            </Button>
                        </div>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="space-y-4">
                                {groupedRooms.map((group) => (
                                    <RoomGroupCollapse
                                        key={group._id}
                                        groupId={group._id}
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
                                        isDragEnabled={isArrangeMode}
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
                                        isDragEnabled={isArrangeMode}
                                    />
                                )}

                                {groupedRooms.length === 0 && ungroupedRooms.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        {t('rooms.noData')}
                                    </div>
                                )}
                            </div>

                            {/* Drag Overlay */}
                            <DragOverlay>
                                {activeRoom && (
                                    <div className="opacity-80 rotate-3 scale-105">
                                        <RoomCard
                                            room={activeRoom}
                                            onCreateContract={onCreateContract}
                                            onViewContract={onViewContract}
                                        />
                                    </div>
                                )}
                            </DragOverlay>
                        </DndContext>
                    </>
                )}
            </CardContent>

            {/* Edit Room Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={(open) => {
                setIsEditModalOpen(open);
                if (!open) setEditingRoomId(null);
            }}>
                <DialogContent
                    className="max-w-3xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>{t('rooms.editTitle')}</DialogTitle>
                        <DialogDescription>{t('rooms.editDescription')}</DialogDescription>
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
                                defaultValues={getEditDefaultValues(editingRoomData)}
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
