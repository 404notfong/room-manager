import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DraggableRoomCard } from './DraggableRoomCard';
import RoomCard from './RoomCard';

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
        serviceCharges?: Array<{ name: string; amount: number; isRecurring: boolean }>;
    };
}

interface RoomGroupCollapseProps {
    groupId?: string;
    groupName: string;
    groupColor?: string;
    rooms: Room[];
    onCreateContract?: (roomId: string) => void;
    onViewContract?: (contractId: string) => void;
    onEdit?: (roomId: string) => void;
    onToggleStatus?: (roomId: string, newStatus: 'AVAILABLE' | 'MAINTENANCE') => void;
    isTogglingStatus?: boolean;
    defaultOpen?: boolean;
    onEditContract?: (contractId: string) => void;
    onActivateContract?: (contract: { _id: string; startDate: string; endDate?: string }) => void;
    isDragEnabled?: boolean;
}

export default function RoomGroupCollapse({
    groupId,
    groupName,
    groupColor,
    rooms,
    onCreateContract,
    onViewContract,
    onEdit,
    onToggleStatus,
    isTogglingStatus,
    defaultOpen = true,
    onEditContract,
    onActivateContract,
    isDragEnabled = false,
}: RoomGroupCollapseProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [currPage, setCurrPage] = useState(0);

    // Dynamic Items Per Page Logic (Max 2 rows)
    const [itemsPerPage, setItemsPerPage] = useState(8); // Default for large screens

    useEffect(() => {
        const calculateItemsPerPage = () => {
            const width = window.innerWidth;
            if (width >= 1920) {
                return 10; // 5 cols * 2 rows
            } else if (width >= 1600) {
                return 8; // 4 cols * 2 rows
            } else if (width >= 1300) {
                return 6; // 3 cols * 2 rows
            } else if (width >= 640) {
                return 4; // 2 cols * 2 rows
            } else {
                return 2; // 1 col * 2 rows
            }
        };

        const handleResize = () => {
            const newItemsPerPage = calculateItemsPerPage();
            setItemsPerPage(prev => {
                if (prev !== newItemsPerPage) {
                    setCurrPage(0); // Reset page on layout change
                    return newItemsPerPage;
                }
                return prev;
            });
        };

        // Initial calculation
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const totalPages = Math.ceil(rooms.length / itemsPerPage);
    const pages = Array.from({ length: totalPages }, (_, i) =>
        rooms.slice(i * itemsPerPage, (i + 1) * itemsPerPage)
    );

    const next = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currPage < totalPages - 1) setCurrPage(p => p + 1);
    };

    const prev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currPage > 0) setCurrPage(p => p - 1);
    };

    // Update internal state if total pages shrink (e.g. after filtering)
    if (currPage >= totalPages && totalPages > 0) {
        setCurrPage(totalPages - 1);
    }

    // Checking Nav button visibility
    const showNav = totalPages > 1;

    // Count rooms by status
    const statusCounts = {
        AVAILABLE: rooms.filter(r => r.status === 'AVAILABLE').length,
        OCCUPIED: rooms.filter(r => r.status === 'OCCUPIED').length,
        MAINTENANCE: rooms.filter(r => r.status === 'MAINTENANCE').length,
        DEPOSITED: rooms.filter(r => r.status === 'DEPOSITED').length,
    };

    // Droppable for receiving cards from other groups
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: groupId || 'ungrouped',
        data: { type: 'group', groupId: groupId || null },
    });

    // Room IDs for sortable context
    const roomIds = rooms.map(r => r._id);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <div
                    className={cn(
                        'flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors',
                        'bg-muted/30 border border-l-4',
                        groupColor ? '' : 'border-l-gray-400'
                    )}
                    style={groupColor ? { borderLeftColor: groupColor } : undefined}
                >
                    <div className="flex items-center gap-3">
                        <ChevronDown
                            className={cn(
                                'h-5 w-5 transition-transform',
                                isOpen ? '' : '-rotate-90'
                            )}
                        />
                        <span className="font-semibold text-lg">{groupName}</span>
                        <Badge variant="secondary" className="text-xs">
                            {rooms.length} {t('common.rooms')}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {statusCounts.OCCUPIED > 0 && (
                            <Badge className="bg-blue-500 text-white text-xs">
                                {statusCounts.OCCUPIED} {t('dashboard.occupied')}
                            </Badge>
                        )}
                        {statusCounts.DEPOSITED > 0 && (
                            <Badge className="bg-orange-500 text-white text-xs">
                                {statusCounts.DEPOSITED} {t('dashboard.deposited')}
                            </Badge>
                        )}
                        {statusCounts.AVAILABLE > 0 && (
                            <Badge className="bg-green-500 text-white text-xs">
                                {statusCounts.AVAILABLE} {t('dashboard.vacant')}
                            </Badge>
                        )}
                        {statusCounts.MAINTENANCE > 0 && (
                            <Badge className="bg-yellow-500 text-white text-xs">
                                {statusCounts.MAINTENANCE} {t('dashboard.maintenance')}
                            </Badge>
                        )}
                    </div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent 
                ref={setDroppableRef}
                className={cn(
                    "relative group/carousel overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up",
                    isOver && isDragEnabled && "ring-2 ring-primary ring-inset bg-primary/5"
                )}
            >
                {/* Navigation Buttons - Show only on hover if preferred, or always */}
                {showNav && (
                    <>
                        <button
                            onClick={prev}
                            disabled={currPage === 0}
                            className={cn(
                                "absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-background shadow-md rounded-full border hover:bg-accent transition-opacity disabled:opacity-0",
                                !isOpen && "hidden"
                            )}
                            type="button"
                        >
                            <ChevronDown className="h-6 w-6 rotate-90" />
                        </button>
                        <button
                            onClick={next}
                            disabled={currPage === totalPages - 1}
                            className={cn(
                                "absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-background shadow-md rounded-full border hover:bg-accent transition-opacity disabled:opacity-0",
                                !isOpen && "hidden"
                            )}
                            type="button"
                        >
                            <ChevronDown className="h-6 w-6 -rotate-90" />
                        </button>
                    </>
                )}

                <div className="overflow-hidden">
                    <div
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${currPage * 100}%)` }}
                    >
                        {pages.map((pageRooms, pageIdx) => (
                            <div key={pageIdx} className="w-full flex-shrink-0 p-4 pl-8">
                                <SortableContext items={roomIds} strategy={rectSortingStrategy} disabled={!isDragEnabled}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 min-[1300px]:grid-cols-3 min-[1600px]:grid-cols-4 min-[1920px]:grid-cols-5 gap-4 content-start">
                                        {pageRooms.map((room) => (
                                            <DraggableRoomCard key={room._id} id={room._id} disabled={!isDragEnabled}>
                                                <RoomCard
                                                    room={room}
                                                    onCreateContract={onCreateContract}
                                                    onViewContract={onViewContract}
                                                    onEdit={onEdit}
                                                    onToggleStatus={onToggleStatus}
                                                    isTogglingStatus={isTogglingStatus}
                                                    onEditContract={onEditContract}
                                                    onActivateContract={onActivateContract}
                                                />
                                            </DraggableRoomCard>
                                        ))}
                                    </div>
                                </SortableContext>
                            </div>
                        ))}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
