import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
}

export default function RoomGroupCollapse({
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
}: RoomGroupCollapseProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [currPage, setCurrPage] = useState(0);

    // Carousel Logic
    const itemsPerPage = 8;
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
                        {statusCounts.AVAILABLE > 0 && (
                            <Badge className="bg-green-500 text-white text-xs">
                                {statusCounts.AVAILABLE} {t('dashboard.vacant')}
                            </Badge>
                        )}
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
                        {statusCounts.MAINTENANCE > 0 && (
                            <Badge className="bg-yellow-500 text-white text-xs">
                                {statusCounts.MAINTENANCE} {t('dashboard.maintenance')}
                            </Badge>
                        )}
                    </div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="relative group/carousel">
                {/* Navigation Buttons - Show only on hover if preferred, or always */}
                {showNav && (
                    <>
                        <button
                            onClick={prev}
                            disabled={currPage === 0}
                            className={cn(
                                "absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-background/80 shadow-md rounded-full border hover:bg-background transition-opacity disabled:opacity-0 sm:-ml-4",
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
                                "absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-background/80 shadow-md rounded-full border hover:bg-background transition-opacity disabled:opacity-0 sm:-mr-4",
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
                            <div key={pageIdx} className="w-full flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 pl-8 content-start">
                                {pageRooms.map((room) => (
                                    <RoomCard
                                        key={room._id}
                                        room={room}
                                        onCreateContract={onCreateContract}
                                        onViewContract={onViewContract}
                                        onEdit={onEdit}
                                        onToggleStatus={onToggleStatus}
                                        isTogglingStatus={isTogglingStatus}
                                        onEditContract={onEditContract}
                                        onActivateContract={onActivateContract}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
