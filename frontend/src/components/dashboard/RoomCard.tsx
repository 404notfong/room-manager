import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Calendar, MoreHorizontal, FileText, Wrench, Plus, Zap, Droplets, Wallet, Package, Loader2, Edit } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format, differenceInCalendarDays } from 'date-fns';

import { PriceTablePopover } from '@/components/PriceTablePopover';

interface RoomCardProps {
    room: {
        _id: string;
        roomCode: string;
        roomName: string;
        floor: number;
        area?: number;
        maxOccupancy?: number;
        status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'DEPOSITED';
        roomType: 'LONG_TERM' | 'SHORT_TERM';
        defaultRoomPrice?: number;
        defaultTermMonths?: number;
        defaultElectricPrice?: number;
        defaultWaterPrice?: number;
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
            shortTermPricingType?: string; // FIXED, TIME_BLOCK, HOURLY
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
    };
    onCreateContract?: (roomId: string) => void;
    onViewContract?: (contractId: string) => void;
    onEdit?: (roomId: string) => void;
    onToggleStatus?: (roomId: string, newStatus: 'AVAILABLE' | 'MAINTENANCE') => void;
    isTogglingStatus?: boolean;
    onEditContract?: (contractId: string) => void;
    onActivateContract?: (contract: { _id: string; startDate: string; endDate?: string }) => void;
}

const statusColors = {
    AVAILABLE: 'border-l-green-500',
    OCCUPIED: 'border-l-blue-500',
    MAINTENANCE: 'border-l-yellow-500',
    DEPOSITED: 'border-l-orange-500',
};

const statusBadgeColors = {
    AVAILABLE: 'bg-green-500 text-white hover:bg-green-600',
    OCCUPIED: 'bg-blue-500 text-white hover:bg-blue-600',
    MAINTENANCE: 'bg-yellow-500 text-white hover:bg-yellow-600',
    DEPOSITED: 'bg-orange-500 text-white hover:bg-orange-600',
};

export default function RoomCard({
    room,
    onCreateContract,
    onViewContract,
    onEdit,
    onToggleStatus,
    isTogglingStatus,
    onEditContract,
    onActivateContract,
}: RoomCardProps) {
    const { t } = useTranslation();



    const activeContract = room.activeContract;
    const isOccupied = (room.status === 'OCCUPIED' || room.status === 'DEPOSITED') && activeContract;

    // --- SUB-RENDERERS ---

    const renderPrice = () => {
        // Long Term
        if (room.roomType === 'LONG_TERM') {
            const term = room.defaultTermMonths || 1;
            let termDisplay = '';
            if (term === 12) {
                termDisplay = `/ 1 ${t('common.year')}`;
            } else {
                termDisplay = `/ ${term} ${t('common.month')}`;
            }
            return (
                <p className="text-3xl font-black text-primary">
                    {room.defaultRoomPrice ? formatCurrency(room.defaultRoomPrice) : '--'}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{termDisplay}</span>
                </p>
            );
        }

        // Short Term
        if (room.shortTermPricingType === 'FIXED') {
            return (
                <p className="text-3xl font-black text-primary">
                    {room.fixedPrice ? formatCurrency(room.fixedPrice) : '--'}
                    <span className="text-sm font-normal text-muted-foreground ml-1">/{t('common.trip')}</span>
                </p>
            );
        }

        if (room.shortTermPricingType === 'HOURLY') {
            if (room.hourlyPricingMode === 'PER_HOUR') {
                return (
                    <p className="text-3xl font-black text-primary">
                        {room.pricePerHour ? formatCurrency(room.pricePerHour) : '--'}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/{t('common.hour')}</span>
                    </p>
                );
            }
            // Table Mode (Visual unification)
            if (room.hourlyPricingMode === 'TABLE' && room.shortTermPrices) {
                return (
                    <div className="flex flex-col items-center gap-1">
                        <PriceTablePopover shortTermPrices={room.shortTermPrices} pricingType="HOURLY" highlightPrice={true} />
                        <span className="text-xs font-medium text-muted-foreground">{t('rooms.priceTable')}</span>
                    </div>
                );
            }
        }

        if (room.shortTermPricingType === 'DAILY' && room.shortTermPrices) {
            return (
                <div className="flex flex-col items-center gap-1">
                    <PriceTablePopover shortTermPrices={room.shortTermPrices} pricingType="DAILY" highlightPrice={true} />
                    <span className="text-xs font-medium text-muted-foreground">{t('rooms.priceTable')}</span>
                </div>
            );
        }

        return <span className="text-muted-foreground">--</span>;
    }

    const renderOccupiedContent = (contract: NonNullable<RoomCardProps['room']['activeContract']>) => {
        // Determine price and unit based on contract type
        let price = contract.rentPrice || 0;
        let unit = t('common.month');
        let label = t('contracts.rentPrice');

        if (contract.contractType === 'SHORT_TERM' || room.roomType === 'SHORT_TERM') {
            if (contract.shortTermPricingType === 'FIXED') {
                price = contract.fixedPrice || 0;
                unit = t('common.trip');
                label = t('contracts.fixedPrice');
            } else if (contract.shortTermPricingType === 'HOURLY') {
                if (contract.hourlyPricingMode === 'PER_HOUR') {
                    price = contract.pricePerHour || 0;
                    unit = t('common.hour');
                    label = t('contracts.pricePerHour');
                } else {
                    // Table/Hybrid mode often defaults to base rent or calculated
                    price = 0; // Or display label for table
                    label = t('contracts.priceTable');
                }
            } else if (contract.shortTermPricingType === 'DAILY') {
                // Table/Hybrid
                price = 0;
                label = t('contracts.priceTable');
            }
        } else {
            // Long Term Logic
            const term = contract.paymentCycleMonths || 1;
            if (term === 12) {
                unit = `1 ${t('common.year')}`;
            } else if (term > 1) {
                unit = `${term} ${t('common.month')}`;
            } else {
                unit = t('common.month');
            }
        }

        // Helper to check if we can show a simple price
        const showPrice = !(contract.shortTermPricingType === 'HOURLY' && contract.hourlyPricingMode === 'TABLE') &&
            !(contract.shortTermPricingType === 'DAILY');

        return (
            <div className="space-y-4">
                {/* Tenant Header */}
                <div className="flex items-center gap-2.5 p-1">
                    <div className="bg-primary/10 p-2 rounded-full shrink-0">
                        <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start">
                            <p className="font-bold text-base truncate leading-tight">{contract.tenantId?.fullName || t('tenants.guest')}</p>
                            {/* Deposit Info (Compact) - For ALL types */}
                            {contract.depositAmount && contract.depositAmount > 0 && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                                    <Wallet className="h-3 w-3 opacity-70" />
                                    {t('contracts.depositShort')}: {formatCurrency(contract.depositAmount)}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">{contract.tenantId?.phone || contract.contractCode}</p>
                    </div>
                </div>

                {/* Financial Ledger Section */}
                <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <div className="space-y-2.5">
                        {/* Main Price Row */}
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 opacity-60" /> {label}
                            </span>
                            {showPrice ? (
                                <span className="font-bold text-primary text-sm">
                                    {formatCurrency(price)}
                                    <span className="text-[10px] opacity-60 ml-0.5 font-normal">/{unit}</span>
                                </span>
                            ) : (
                                <Badge variant="outline" className="text-[10px] h-5 px-2 bg-primary/5 text-primary border-primary/20">
                                    {t('rooms.priceTable')}
                                </Badge>
                            )}
                        </div>

                        <div className="h-px bg-border/40 my-1" />

                        {/* Utilities Detail (Only show if prices exist and > 0, typical for Long Term) */}
                        {(contract.electricityPrice !== undefined && contract.electricityPrice > 0 || contract.waterPrice !== undefined && contract.waterPrice > 0) && (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-muted/40 dark:bg-white/10 rounded p-2 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center h-full">
                                    <p className="text-[10px] uppercase font-semibold text-muted-foreground/80 mb-1 flex items-center gap-1.5">
                                        <Zap className="h-3 w-3 text-yellow-500" /> {t('services.electricity')}
                                    </p>
                                    <span className="text-sm font-bold text-primary">
                                        {formatCurrency(contract.electricityPrice || 0)}
                                        <span className="text-[10px] opacity-60 ml-0.5 font-normal">/số</span>
                                    </span>
                                </div>
                                <div className="bg-muted/40 dark:bg-white/10 rounded p-2 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center h-full">
                                    <p className="text-[10px] uppercase font-semibold text-muted-foreground/80 mb-1 flex items-center gap-1.5">
                                        <Droplets className="h-3 w-3 text-blue-500" /> {t('services.water')}
                                    </p>
                                    <span className="text-sm font-bold text-primary">
                                        {formatCurrency(contract.waterPrice || 0)}
                                        <span className="text-[10px] opacity-60 ml-0.5 font-normal">/số</span>
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Services Only (if any) */}
                        {contract.serviceCharges && contract.serviceCharges.length > 0 && (
                            <div className="pt-1.5 border-t border-border/40 space-y-2">
                                <div className="space-y-1 mt-2">
                                    <div className="flex items-center gap-1.5 mb-1.5 opacity-70">
                                        <Package className="h-3 w-3" />
                                        <p className="text-[10px] uppercase font-bold tracking-wider">{t('contracts.services')}</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {contract.serviceCharges.slice(0, 3).map((s, i) => (
                                            <div key={i} className="flex justify-between items-center bg-background/50 backdrop-blur-sm px-2 py-1 rounded border border-border/30 text-[10px]">
                                                <span className="truncate mr-2 max-w-[100px] font-medium text-muted-foreground">
                                                    {s.name}
                                                    {(s.quantity || 1) > 1 && <span className="text-[9px] ml-1 bg-primary/10 px-1 rounded text-primary">x{s.quantity}</span>}
                                                </span>
                                                <span className="font-bold shrink-0 text-primary">{formatCurrency(s.amount * (s.quantity || 1))}</span>
                                            </div>
                                        ))}
                                        {contract.serviceCharges.length > 3 && (
                                            <p className="text-[9px] text-center opacity-60 font-medium py-0.5">
                                                +{contract.serviceCharges.length - 3} {t('common.more')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Deposit Info - Moved to Header */}

                {/* Date Info Section */}
                {(() => {
                    // Logic for Date Display
                    let dateLabel = t('contracts.startDate');
                    let dateValue = contract.startDate ? format(new Date(contract.startDate), 'dd/MM/yyyy') : '--/--/----';
                    let dateColorClass = "bg-blue-50 text-blue-700 border-blue-100/50";
                    let additionalInfo = null;

                    if (room.roomType === 'LONG_TERM') {
                        if (room.status === 'DEPOSITED' && contract.startDate) {
                            dateLabel = t('contracts.startDate');
                            // Muted style for Deposited
                            dateColorClass = "bg-gray-100 text-gray-600 border-gray-200";

                            const start = new Date(contract.startDate);
                            const today = new Date();
                            const diffDays = differenceInCalendarDays(start, today);

                            if (diffDays < 0) {
                                // Overdue
                                additionalInfo = (
                                    <span className="text-[10px] font-bold text-red-500 ml-2 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        {t('contracts.daysOverdue', { days: Math.abs(diffDays) })}
                                    </span>
                                );
                            } else {
                                // Remaining
                                additionalInfo = (
                                    <span className="text-[10px] text-muted-foreground ml-2">
                                        ({t('contracts.daysRemaining', { days: diffDays })})
                                    </span>
                                );
                            }
                        } else if (room.status === 'OCCUPIED' && contract.startDate) {
                            dateLabel = t('contracts.nextPayment');
                            dateColorClass = "bg-green-50 text-green-700 border-green-100/50";

                            // Calculate Next Payment Date
                            const start = new Date(contract.startDate);
                            const today = new Date();
                            const cycleMonths = contract.paymentCycleMonths || 1;

                            // Find next payment date >= today
                            // Iterative approach to find next future date:
                            // Start from contract start, jump by cycleMonths until > today (or close to it)
                            // Ideally we want the *upcoming* payment.

                            // Simplified robust logic:
                            // 1. Calculate months difference from start to today
                            // 2. Add that many cycles

                            let currentCycleDate = new Date(start);

                            // Naive loop (safe for reasonable dates)
                            while (currentCycleDate < today) {
                                currentCycleDate.setMonth(currentCycleDate.getMonth() + cycleMonths);

                                // Apply Due Day constraint if specific
                                if (contract.paymentDueDay) {
                                    // If dueDay is 31 or larger than days in month, Date automatically handles it (e.g. Feb 30 -> Mar 2)
                                    // But usually "Last Day" intent means strictly last day of THAT month.
                                    // Given "paymentDueDay" is integer 1-31.
                                    // If user selected 31 (last day), we should clamp to end of month.

                                    const year = currentCycleDate.getFullYear();
                                    const month = currentCycleDate.getMonth();
                                    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

                                    let targetDay = contract.paymentDueDay;
                                    if (targetDay > lastDayOfMonth) targetDay = lastDayOfMonth;

                                    currentCycleDate.setDate(targetDay);

                                    // Check if setting the day moved it back (e.g. from 31 to 28) or we need to re-verify < today
                                }
                            }

                            dateValue = format(currentCycleDate, 'dd/MM/yyyy');
                        }
                    } else {
                        // Short Term Logic
                        if (contract.endDate) {
                            dateLabel = t('contracts.checkOut');
                            const end = new Date(contract.endDate);
                            const today = new Date();

                            // Check precise difference
                            const diffHours = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60));
                            const diffDays = Math.ceil(diffHours / 24);

                            dateValue = format(end, 'dd/MM/yyyy HH:mm');

                            if (diffHours < 0) {
                                // Overdue
                                dateColorClass = "bg-red-50 text-red-700 border-red-100/50";
                                additionalInfo = (
                                    <span className="text-[10px] font-bold text-red-500 ml-2 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        {t('contracts.daysOverdue', { days: Math.abs(diffDays) })}
                                    </span>
                                );
                            } else {
                                // Active / Remaining
                                dateColorClass = "bg-purple-50 text-purple-700 border-purple-100/50";
                                if (diffHours < 24) {
                                    additionalInfo = (
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            ({t('contracts.hoursRemaining', { hours: diffHours })})
                                        </span>
                                    );
                                } else {
                                    additionalInfo = (
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            ({t('contracts.daysRemaining', { days: diffDays })})
                                        </span>
                                    );
                                }
                            }
                        } else {
                            // Fallback if no end date
                            dateLabel = t('contracts.checkIn');
                        }
                    }

                    return (
                        <div className={`flex items-center justify-between text-[11px] font-medium px-2.5 py-2 rounded-md border ${dateColorClass}`}>
                            <div className="flex items-center">
                                <span className="flex items-center gap-1.5 opacity-80">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {dateLabel}
                                </span>
                                {additionalInfo}
                            </div>
                            <span className="font-bold">{dateValue}</span>
                        </div>
                    );
                })()}
            </div>
        );
    };

    const renderEmptyState = () => {
        return (
            <div className="flex-1 flex flex-col justify-center items-center py-4 space-y-4">
                <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('rooms.listingWait')}</p>
                    {renderPrice()}


                </div>

                <Badge className={cn("w-full justify-center py-1.5 text-sm font-bold shadow-sm", statusBadgeColors[room.status])}>
                    {t(`rooms.status.${room.status}`)}
                </Badge>

                {/* Display Default Utilities for Long Term */}
                {room.roomType === 'LONG_TERM' && (
                    <div className="w-full pt-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-muted/40 dark:bg-white/10 rounded p-2 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center h-full">
                                <p className="text-[10px] uppercase font-semibold text-muted-foreground/80 mb-1 flex items-center gap-1.5">
                                    <Zap className="h-3 w-3 text-yellow-500" /> {t('services.electricity')}
                                </p>
                                <span className="text-sm font-bold text-primary">
                                    {room.defaultElectricPrice ? formatCurrency(room.defaultElectricPrice) : '--'}
                                    <span className="text-[10px] opacity-60 ml-0.5 font-normal">/số</span>
                                </span>
                            </div>
                            <div className="bg-muted/40 dark:bg-white/10 rounded p-2 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center h-full">
                                <p className="text-[10px] uppercase font-semibold text-muted-foreground/80 mb-1 flex items-center gap-1.5">
                                    <Droplets className="h-3 w-3 text-blue-500" /> {t('services.water')}
                                </p>
                                <span className="text-sm font-bold text-primary">
                                    {room.defaultWaterPrice ? formatCurrency(room.defaultWaterPrice) : '--'}
                                    <span className="text-[10px] opacity-60 ml-0.5 font-normal">/số</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card className={cn(
            "overflow-hidden border-l-4 transition-all hover:shadow-lg h-full flex flex-col group dark:bg-[#292F3D]",
            statusColors[room.status],
            room.status === 'DEPOSITED' && "bg-orange-50/10"
        )}>
            <CardContent className="p-4 flex-1 flex flex-col">
                {/* Global Card Top: Room Basics */}
                <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="font-black text-2xl leading-none truncate tracking-tight">{room.roomName}</h3>
                            <div className="flex gap-1">
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        "text-[10px] h-5 px-2 font-bold shrink-0 border",
                                        room.roomType === 'LONG_TERM'
                                            ? "bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20"
                                            : "bg-purple-100/50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20"
                                    )}
                                >
                                    {room.roomType === 'LONG_TERM' ? t('rooms.roomTypeLongTerm') : t('rooms.roomTypeShortTerm')}
                                </Badge>
                                {room.status === 'DEPOSITED' && (
                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-orange-500 hover:bg-orange-600 text-white border-0">
                                        {t('rooms.status.DEPOSITED')}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80 flex-wrap">
                            <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-xs text-foreground/70">{room.roomCode}</span>
                            <span className="bg-primary/5 px-1.5 py-0.5 rounded italic whitespace-nowrap">{t('rooms.floor_display', { floor: room.floor })}</span>
                            {room.area ? (
                                <span className="bg-primary/5 px-1.5 py-0.5 rounded italic whitespace-nowrap">
                                    {room.area} m²
                                </span>
                            ) : null}
                            {room.maxOccupancy ? (
                                <span className="bg-primary/5 px-1.5 py-0.5 rounded italic whitespace-nowrap flex items-center gap-1">
                                    <User className="h-3 w-3" /> {room.maxOccupancy}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {room.status === 'AVAILABLE' && (
                                <DropdownMenuItem onClick={() => onCreateContract?.(room._id)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('dashboard.actions.createContract')}
                                </DropdownMenuItem>
                            )}
                            {isOccupied && activeContract && room.status === 'OCCUPIED' && (
                                <DropdownMenuItem onClick={() => onViewContract?.(activeContract._id)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    {t('dashboard.actions.viewContract')}
                                </DropdownMenuItem>
                            )}
                            {room.status === 'DEPOSITED' && activeContract && (
                                <>
                                    <DropdownMenuItem onClick={() => onActivateContract?.({ ...activeContract, startDate: activeContract.startDate || new Date().toISOString() })}>
                                        <Zap className="mr-2 h-4 w-4" />
                                        {t('contracts.activateTitle')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onEditContract?.(activeContract._id)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        {t('contracts.editTitle')}
                                    </DropdownMenuItem>
                                </>
                            )}
                            {room.status !== 'OCCUPIED' && (
                                <DropdownMenuItem onClick={() => onEdit?.(room._id)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    {t('dashboard.actions.editRoom')}
                                </DropdownMenuItem>
                            )}
                            {room.status !== 'OCCUPIED' && room.status !== 'DEPOSITED' && (
                                <DropdownMenuItem
                                    disabled={isTogglingStatus}
                                    onClick={() => onToggleStatus?.(room._id, room.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE')}
                                >
                                    {isTogglingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                                    {room.status === 'MAINTENANCE' ? t('dashboard.actions.finishMaintenance') : t('dashboard.actions.maintenance')}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Themed Body Content */}
                <div className="flex-1">
                    {isOccupied && activeContract ? (
                        renderOccupiedContent(activeContract)
                    ) : (
                        renderEmptyState()
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
