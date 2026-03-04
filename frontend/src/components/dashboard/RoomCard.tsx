import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { differenceInCalendarDays, format } from 'date-fns';
import { Calendar, ChevronDown, Droplets, Edit, FileText, Loader2, MoreHorizontal, Package, Plus, User, Wallet, Wrench, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
        priceTableType?: 'PROGRESSIVE' | 'FLAT';
        roomGroupId?: { _id: string; name: string; color?: string };
        description?: string;
        activeContract?: {
            _id: string;
            tenantId?: { _id: string; fullName: string; phone?: string };
            notes?: string;
            endDate?: string;
            startDate?: string;
            contractCode?: string;
            contractType?: 'LONG_TERM' | 'SHORT_TERM';
            rentPrice?: number;
            shortTermPricingType?: string; // FIXED, TIME_BLOCK, HOURLY, DAILY
            hourlyPricingMode?: string;
            pricePerHour?: number;
            fixedPrice?: number;
            shortTermPrices?: { fromValue: number; toValue: number; price: number }[];
            priceTableType?: 'PROGRESSIVE' | 'FLAT';
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
    onActivateContract?: (contract: { 
        _id: string; 
        startDate: string; 
        endDate?: string; 
        paymentCycleMonths?: number;
        paymentDueDay?: number;
    }) => void;
}

const statusColors = {
    AVAILABLE: 'border-l-green-500',
    OCCUPIED: 'border-l-blue-500',
    MAINTENANCE: 'border-l-yellow-500',
    DEPOSITED: 'border-l-orange-500',
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
            } else if (term > 1) {
                termDisplay = `/ ${term} ${t('rooms.months')}`;
            } else {
                termDisplay = `/ ${term} ${t('rooms.month')}`;
            }
            return (
                <p className="text-lg font-bold text-primary leading-none">
                    {room.defaultRoomPrice ? formatCurrency(room.defaultRoomPrice) : '--'}
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">{termDisplay}</span>
                </p>
            );
        }

        // Short Term
        if (room.shortTermPricingType === 'FIXED') {
            return (
                <p className="text-lg font-bold text-primary leading-none">
                    {room.fixedPrice ? formatCurrency(room.fixedPrice) : '--'}
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">/{t('common.trip')}</span>
                </p>
            );
        }

        if (room.shortTermPricingType === 'HOURLY') {
            if (room.hourlyPricingMode === 'PER_HOUR') {
                return (
                    <p className="text-lg font-bold text-primary leading-none">
                        {room.pricePerHour ? formatCurrency(room.pricePerHour) : '--'}
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">/{t('common.hour')}</span>
                    </p>
                );
            }
            // Table Mode (Visual unification)
            if (room.hourlyPricingMode === 'TABLE' && room.shortTermPrices) {
                    return (
                        <div className="flex flex-col items-center gap-1">
                            <PriceTablePopover shortTermPrices={room.shortTermPrices} pricingType="HOURLY" priceTableType={room.priceTableType} highlightPrice={true} />
                            <span className="text-xs font-medium text-muted-foreground">{t('rooms.priceTable')}</span>
                        </div>
                    );
            }
        }

        if (room.shortTermPricingType === 'DAILY' && room.shortTermPrices) {
            return (
                <div className="flex flex-col items-center gap-1">
                    <PriceTablePopover shortTermPrices={room.shortTermPrices} pricingType="DAILY" priceTableType={room.priceTableType} highlightPrice={true} />
                    <span className="text-xs font-medium text-muted-foreground">{t('rooms.priceTable')}</span>
                </div>
            );
        }

        return <span className="text-muted-foreground">--</span>;
    }

    const renderOccupiedContent = (contract: NonNullable<RoomCardProps['room']['activeContract']>) => {
        // Determine price and unit based on contract type
        let price = contract.rentPrice || 0;
        let unit = t('rooms.month');
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
                unit = `${term} ${t('rooms.months')}`;
            } else {
                unit = t('rooms.month');
            }
        }

        // Helper to check if we can show a simple price
        const showPrice = !(contract.shortTermPricingType === 'HOURLY' && contract.hourlyPricingMode === 'TABLE') &&
            !(contract.shortTermPricingType === 'DAILY');

        return (
            <div className="space-y-2">
                {/* Tenant Header */}
                <div className="flex items-center gap-1.5 p-0">
                    <div className="bg-primary/10 p-1 rounded-full shrink-0">
                        <User className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 leading-none">
                        <div className="flex justify-between items-center mb-0.5">
                            <p className="font-bold text-xs truncate">{contract.tenantId?.fullName || t('tenants.guest')}</p>
                            {/* Deposit Info (Compact) */}
                            {(contract.depositAmount !== undefined) && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0 bg-muted/50 px-1 py-0 rounded border border-border/50">
                                    <Wallet className="h-2 w-2 opacity-70" />
                                    {contract.depositAmount > 0 
                                        ? formatCurrency(contract.depositAmount)
                                        : <span className="text-[8px] uppercase font-semibold">{t('contracts.noDeposit')}</span>
                                    }
                                </span>
                            )}
                        </div>
                        <p className="text-[9px] text-muted-foreground">{contract.tenantId?.phone || contract.contractCode}</p>
                    </div>
                </div>

                {/* Financial Ledger Section */}
                <div className="bg-muted/30 rounded-lg p-2 border border-border/50">
                    <div className="space-y-1.5">
                        {/* Main Price Row */}
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 opacity-60" /> {label}
                            </span>
                            {showPrice ? (
                                <span className="font-bold text-primary text-sm">
                                    {formatCurrency(price)}
                                    <span className="text-[10px] text-muted-foreground ml-0.5 font-normal">/{unit}</span>
                                </span>
                            ) : contract.shortTermPrices && contract.shortTermPrices.length > 0 ? (
                                <PriceTablePopover 
                                    shortTermPrices={contract.shortTermPrices} 
                                    pricingType={contract.shortTermPricingType === 'DAILY' ? 'DAILY' : 'HOURLY'} 
                                    priceTableType={contract.priceTableType}
                                    highlightPrice={true} 
                                />
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
                                <div className="bg-muted/40 dark:bg-white/10 rounded p-1.5 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center">
                                    <p className="text-[9px] uppercase font-semibold text-muted-foreground/80 mb-0.5 flex items-center gap-1">
                                        <Zap className="h-2.5 w-2.5 text-yellow-500" /> {t('services.electricity')}
                                    </p>
                                    <span className="text-xs font-bold text-primary">
                                        {formatCurrency(contract.electricityPrice || 0)}
                                        <span className="text-[9px] text-muted-foreground ml-0.5 font-normal">/{t('contracts.unitIndex').toLowerCase()}</span>
                                    </span>
                                </div>
                                <div className="bg-muted/40 dark:bg-white/10 rounded p-1.5 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center">
                                    <p className="text-[9px] uppercase font-semibold text-muted-foreground/80 mb-0.5 flex items-center gap-1">
                                        <Droplets className="h-2.5 w-2.5 text-blue-500" /> {t('services.water')}
                                    </p>
                                    <span className="text-xs font-bold text-primary">
                                        {formatCurrency(contract.waterPrice || 0)}
                                        <span className="text-[9px] text-muted-foreground ml-0.5 font-normal">/{t('contracts.unitIndex').toLowerCase()}</span>
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Services Only (if any) */}
                        {contract.serviceCharges && contract.serviceCharges.length > 0 && (
                            <div className="pt-1 border-t border-border/40">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <div className="flex items-center justify-between cursor-pointer hover:text-primary rounded px-1 py-0.5 transition-colors group" role="button" tabIndex={0}>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1.5 group-hover:text-foreground">
                                                <Package className="h-3.5 w-3.5 opacity-60" />
                                                {t('contracts.services')}
                                                <span className="text-[9px] text-primary/70 group-hover:text-primary flex items-center gap-0.5">
                                                    {contract.serviceCharges.length}
                                                    <ChevronDown className="h-2.5 w-2.5" />
                                                </span>
                                            </span>
                                            <span className="font-bold text-primary text-sm">
                                                {formatCurrency(contract.serviceCharges.reduce((sum, s) => sum + (s.amount * (s.quantity || 1)), 0))}
                                            </span>
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-3" align="end">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between border-b pb-1.5 mb-1">
                                                <p className="font-semibold text-sm">{t('contracts.services')}</p>
                                                <span className="text-xs font-bold text-primary">
                                                    {formatCurrency(contract.serviceCharges.reduce((sum, s) => sum + (s.amount * (s.quantity || 1)), 0))}
                                                </span>
                                            </div>
                                            <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-1">
                                                {contract.serviceCharges.map((s, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs">
                                                        <span className="truncate mr-2 text-muted-foreground">
                                                            {s.name}
                                                            {(s.quantity || 1) > 1 && <span className="text-[10px] ml-1 bg-primary/10 px-1 rounded text-primary">x{s.quantity}</span>}
                                                        </span>
                                                        <span className="font-bold shrink-0">{formatCurrency(s.amount * (s.quantity || 1))}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
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
                    let isPaymentDate = false; // Track if this is a payment date (uses Wallet icon)

                    if (room.roomType === 'LONG_TERM') {
                        if (room.status === 'DEPOSITED' && contract.startDate) {
                            dateLabel = t('contracts.expectedStartDate');
                            // Default to blue, will be overridden based on days remaining
                            dateColorClass = "bg-blue-50 text-blue-700 border-blue-100/50";

                            const start = new Date(contract.startDate);
                            const today = new Date();
                            const diffCalendarDays = differenceInCalendarDays(start, today);

                            if (diffCalendarDays < 0) {
                                // Overdue (Days only)
                                dateColorClass = "bg-red-50 text-red-700 border-red-100/50 font-bold";
                                const overdueDays = Math.abs(diffCalendarDays);
                                
                                additionalInfo = (
                                    <span className="text-[10px] font-bold text-red-500 ml-2 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        {t('contracts.daysOverdue', { days: overdueDays })}
                                    </span>
                                );
                            } else if (diffCalendarDays === 0) {
                                // Today
                                dateValue = t('common.today');
                                dateColorClass = "bg-yellow-50 text-yellow-700 border-yellow-100/50 font-bold";
                            } else if (diffCalendarDays <= 3) {
                                // <= 3 Days (Yellow Warning)
                                dateColorClass = "bg-yellow-50 text-yellow-700 border-yellow-100/50";
                                additionalInfo = (
                                    <span className="text-[10px] text-yellow-600 ml-2">
                                        ({t('contracts.daysRemaining', { days: diffCalendarDays })})
                                    </span>
                                );
                            } else {
                                // Normal (> 3 days) - BLUE (already set above)
                                additionalInfo = (
                                    <span className="text-[10px] text-muted-foreground ml-2">
                                        ({t('contracts.daysRemaining', { days: diffCalendarDays })})
                                    </span>
                                );
                            }
                        } else if (room.status === 'OCCUPIED' && contract.startDate) {
                            dateLabel = t('contracts.nextPayment');
                            dateColorClass = "bg-green-50 text-green-700 border-green-100/50";
                            isPaymentDate = true; // Use Wallet icon for payment dates

                            // Calculate Next Payment Date
                            const start = new Date(contract.startDate);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0); // Normalize to start of day
                            const cycleMonths = contract.paymentCycleMonths || 1;

                            // Determine payment day of month
                            const payDay = contract.paymentDueDay || start.getDate();

                            // Helper: clamp day to last day of month
                            const clampDay = (d: Date, day: number) => {
                                const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                d.setDate(Math.min(day, lastDay));
                            };

                            // Calculate the earliest allowed payment date:
                            // First payment must be >= 1 full cycle after contract start
                            const minFirstPayment = new Date(start.getFullYear(), start.getMonth() + cycleMonths, 1);

                            // Start scanning from the first cycle after contract start
                            let nextPayment = new Date(minFirstPayment.getFullYear(), minFirstPayment.getMonth(), 1);
                            clampDay(nextPayment, payDay);

                            // If the payment day in this month is before start + cycle, advance one more cycle
                            if (nextPayment < minFirstPayment) {
                                nextPayment = new Date(nextPayment.getFullYear(), nextPayment.getMonth() + cycleMonths, 1);
                                clampDay(nextPayment, payDay);
                            }

                            // Now advance by cycles until >= today
                            while (nextPayment < today) {
                                nextPayment = new Date(nextPayment.getFullYear(), nextPayment.getMonth() + cycleMonths, 1);
                                clampDay(nextPayment, payDay);
                            }

                            dateValue = format(nextPayment, 'dd/MM/yyyy');
                            
                            // Calculate days remaining until next payment
                            const diffDays = differenceInCalendarDays(nextPayment, today);
                            
                            if (diffDays === 0) {
                                // Due today
                                dateColorClass = "bg-orange-100 text-orange-700 border-orange-200 font-bold";
                                additionalInfo = (
                                    <span className="text-[10px] font-bold text-orange-600 ml-2">
                                        ({t('common.today')})
                                    </span>
                                );
                            } else if (diffDays <= 3) {
                                // Due soon (within 3 days)
                                dateColorClass = "bg-yellow-50 text-yellow-700 border-yellow-100/50";
                                additionalInfo = (
                                    <span className="text-[10px] text-yellow-600 ml-2">
                                        ({t('contracts.daysRemaining', { days: diffDays })})
                                    </span>
                                );
                            } else {
                                // Normal - show days remaining
                                additionalInfo = (
                                    <span className="text-[10px] text-muted-foreground ml-2">
                                        ({t('contracts.daysRemaining', { days: diffDays })})
                                    </span>
                                );
                            }
                        }
                    } else {
                        // Short Term Logic
                        if (room.status === 'DEPOSITED') {
                            // Expected dates for deposited short-term
                            if (contract.startDate) {
                                dateLabel = t('contracts.expectedCheckIn');
                                dateValue = format(new Date(contract.startDate), 'dd/MM/yyyy HH:mm');
                                dateColorClass = "bg-gray-100 text-gray-600 border-gray-200";
                                
                                const start = new Date(contract.startDate);
                                const today = new Date();
                                const diffCalendarDays = differenceInCalendarDays(start, today);
                                const diffMs = start.getTime() - today.getTime();
                                
                                if (diffMs < 0) {
                                    // Overdue
                                    dateColorClass = "bg-red-50 text-red-700 border-red-100/50 font-bold";
                                    const absDiffMs = Math.abs(diffMs);
                                    const overdueDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
                                    const overdueHours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                    const overdueMinutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

                                    if (overdueDays > 0) {
                                        additionalInfo = (
                                            <span className="text-[10px] font-bold text-red-500 ml-2 flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                {t('contracts.daysHoursOverdue', { days: overdueDays, hours: overdueHours })}
                                            </span>
                                        );
                                    } else {
                                        additionalInfo = (
                                            <span className="text-[10px] font-bold text-red-500 ml-2 flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                {overdueHours > 0 
                                                    ? t('contracts.hoursMinutesOverdue', { hours: overdueHours, minutes: overdueMinutes })
                                                    : t('contracts.minutesOverdue', { minutes: overdueMinutes })
                                                }
                                            </span>
                                        );
                                    }
                                } else if (diffCalendarDays === 0) {
                                    // Today
                                    dateValue = `${t('common.today')} ${format(start, 'HH:mm')}`;
                                    dateColorClass = "bg-yellow-50 text-yellow-700 border-yellow-100/50 font-bold";
                                } else if (diffCalendarDays <= 3) {
                                    // <= 3 Days (Yellow Warning) - Show days and hours for Short Term
                                    dateColorClass = "bg-yellow-50 text-yellow-700 border-yellow-100/50";
                                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                    const diffHoursPart = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                                    additionalInfo = (
                                        <span className="text-[10px] text-yellow-600 ml-2">
                                            ({t('contracts.daysHoursRemaining', { days: diffDays, hours: diffHoursPart })})
                                        </span>
                                    );
                                } else {
                                    // Normal (> 3 days) - BLUE
                                    dateColorClass = "bg-blue-50 text-blue-700 border-blue-100/50";
                                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                    const diffHoursPart = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                    
                                    additionalInfo = (
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            ({t('contracts.daysHoursRemaining', { days: diffDays, hours: diffHoursPart })})
                                        </span>
                                    );
                                }
                            }
                        } else if (contract.endDate) {
                            // Has checkout - show both checkin and checkout
                            dateLabel = t('contracts.checkOut');
                            const end = new Date(contract.endDate);
                            const today = new Date();

                            // Check precise difference
                            const diffHours = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60));

                            dateValue = format(end, 'dd/MM/yyyy HH:mm');
                            // Calculate days difference for color logic
                            const diffCalendarDays = differenceInCalendarDays(end, today);

                            if (diffHours < 0) {
                                // Overdue - RED with badge
                                dateColorClass = "bg-red-50 text-red-700 border-red-100/50";
                                
                                const msOverdue = today.getTime() - end.getTime();
                                const oDays = Math.floor(msOverdue / (1000 * 60 * 60 * 24));
                                const oHours = Math.floor((msOverdue % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const oMinutes = Math.floor((msOverdue % (1000 * 60 * 60)) / (1000 * 60));

                                let overdueText = "";
                                if (oDays > 0) {
                                    overdueText = t('contracts.daysHoursMinutesOverdue', { days: oDays, hours: oHours, minutes: oMinutes });
                                } else if (oHours > 0) {
                                    overdueText = t('contracts.hoursMinutesOverdue', { hours: oHours, minutes: oMinutes });
                                } else {
                                    overdueText = t('contracts.minutesOverdue', { minutes: oMinutes });
                                }

                                additionalInfo = (
                                    <span className="text-[10px] font-bold text-red-500 ml-2 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        {overdueText}
                                    </span>
                                );
                            } else if (diffCalendarDays <= 3) {
                                // Approaching (<= 3 days) - YELLOW
                                dateColorClass = "bg-yellow-50 text-yellow-700 border-yellow-100/50";
                                
                                const msRemaining = end.getTime() - today.getTime();
                                const rDays = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
                                const rHours = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const rMinutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

                                let remainingText = "";
                                if (rDays > 0) {
                                    remainingText = t('contracts.daysHoursMinutesRemaining', { days: rDays, hours: rHours, minutes: rMinutes });
                                } else if (rHours > 0) {
                                    remainingText = t('contracts.hoursMinutesRemaining', { hours: rHours, minutes: rMinutes });
                                } else {
                                    remainingText = t('contracts.minutesRemaining', { minutes: rMinutes });
                                }

                                additionalInfo = (
                                    <span className="text-[10px] font-bold text-yellow-600 ml-2">
                                        ({remainingText})
                                    </span>
                                );
                            } else {
                                // Normal (> 3 days) - BLUE
                                dateColorClass = "bg-blue-50 text-blue-700 border-blue-100/50";
                                
                                const msRemaining = end.getTime() - today.getTime();
                                const rDays = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
                                const rHours = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const rMinutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

                                if (rDays > 0) {
                                    additionalInfo = (
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            ({t('contracts.daysHoursMinutesRemaining', { days: rDays, hours: rHours, minutes: rMinutes })})
                                        </span>
                                    );
                                } else if (rHours > 0) {
                                    additionalInfo = (
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            ({t('contracts.hoursMinutesRemaining', { hours: rHours, minutes: rMinutes })})
                                        </span>
                                    );
                                } else {
                                    additionalInfo = (
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            ({t('contracts.minutesRemaining', { minutes: rMinutes })})
                                        </span>
                                    );
                                }
                            }

                            // Calculate status flags for styling
                            const checkoutEnd = new Date(contract.endDate);
                            const now = new Date();
                            const checkoutDiffHours = Math.floor((checkoutEnd.getTime() - now.getTime()) / (1000 * 60 * 60));
                            const checkoutDiffDays = differenceInCalendarDays(checkoutEnd, now);
                            const isOverdue = checkoutDiffHours < 0;
                            const isApproaching = !isOverdue && checkoutDiffDays <= 3;
                            
                            // Show both check-in and check-out for SHORT_TERM OCCUPIED
                            return (
                                <div className="space-y-0.5 text-[10px]">
                                    {/* Check-in row */}
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-green-500" />
                                            {t('contracts.checkIn')}
                                        </span>
                                        <span className="font-medium text-foreground">
                                            {contract.startDate ? format(new Date(contract.startDate), 'dd/MM/yyyy HH:mm') : '--/--/---- --:--'}
                                        </span>
                                    </div>
                                    {/* Check-out row */}
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className={`h-3 w-3 ${isOverdue ? 'text-red-500' : isApproaching ? 'text-yellow-500' : 'text-blue-500'}`} />
                                            <span>{dateLabel}</span>
                                            {additionalInfo}
                                        </div>
                                        <span className={`font-medium ${isOverdue ? 'text-red-600' : isApproaching ? 'text-yellow-600' : 'text-foreground'}`}>
                                            {dateValue}
                                        </span>
                                    </div>
                                </div>
                            );
                        } else {
                            // No end date - show both check-in and placeholder check-out
                            return (
                                <div className="space-y-0.5 text-[10px]">
                                    {/* Check-in row */}
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-green-500" />
                                            {t('contracts.checkIn')}
                                        </span>
                                        <span className="font-medium text-foreground">
                                            {contract.startDate ? format(new Date(contract.startDate), 'dd/MM/yyyy HH:mm') : '--/--/---- --:--'}
                                        </span>
                                    </div>
                                    {/* Check-out row (placeholder) */}
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-gray-400" />
                                            {t('contracts.checkOut')}
                                        </span>
                                        <span className="font-medium text-muted-foreground italic">{t('contracts.notSet')}</span>
                                    </div>
                                </div>
                            );
                        }
                    }

                    // Long-term or Deposited - simpler single row
                    const iconColor = dateColorClass.includes('red') ? 'text-red-500' : 
                                     dateColorClass.includes('yellow') || dateColorClass.includes('orange') ? 'text-yellow-500' : 
                                     dateColorClass.includes('green') ? 'text-green-500' : 'text-blue-500';
                    const textColor = dateColorClass.includes('red') ? 'text-red-600' : 
                                     dateColorClass.includes('yellow') || dateColorClass.includes('orange') ? 'text-yellow-600' : 'text-foreground';
                    
                    const DateIcon = isPaymentDate ? Wallet : Calendar;

                    return (
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <DateIcon className={`h-3 w-3 ${iconColor}`} />
                                <span>{dateLabel}</span>
                                {additionalInfo}
                            </div>
                            <span className={`font-medium ${textColor}`}>{dateValue}</span>
                        </div>
                    );
                })()}
            </div>
        );
    };

    const renderEmptyState = () => {
        return (
            <div className="flex-1 flex flex-col justify-center items-center py-2 space-y-2">
                <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('rooms.listingWait')}</p>
                    {renderPrice()}


                </div>



                {/* Display Default Utilities for Long Term */}
                {room.roomType === 'LONG_TERM' && (
                    <div className="w-full pt-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-muted/40 dark:bg-white/10 rounded p-1.5 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center">
                                <p className="text-[9px] uppercase font-semibold text-muted-foreground/80 mb-0.5 flex items-center gap-1">
                                    <Zap className="h-2.5 w-2.5 text-yellow-500" /> {t('services.electricity')}
                                </p>
                                <span className="text-xs font-bold text-primary">
                                    {room.defaultElectricPrice ? formatCurrency(room.defaultElectricPrice) : '--'}
                                    <span className="text-[9px] opacity-60 ml-0.5 font-normal">/{t('contracts.unitIndex').toLowerCase()}</span>
                                </span>
                            </div>
                            <div className="bg-muted/40 dark:bg-white/10 rounded p-1.5 border border-border/50 dark:border-white/10 shadow-sm flex flex-col justify-center">
                                <p className="text-[9px] uppercase font-semibold text-muted-foreground/80 mb-0.5 flex items-center gap-1">
                                    <Droplets className="h-2.5 w-2.5 text-blue-500" /> {t('services.water')}
                                </p>
                                <span className="text-xs font-bold text-primary">
                                    {room.defaultWaterPrice ? formatCurrency(room.defaultWaterPrice) : '--'}
                                    <span className="text-[9px] opacity-60 ml-0.5 font-normal">/{t('contracts.unitIndex').toLowerCase()}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Get tooltip content: prioritize contract notes, fallback to room description
    const tooltipContent = activeContract?.notes || room.description;

    const cardElement = (
        <Card className={cn(
            "overflow-hidden border-l-8 transition-all hover:shadow-lg h-full flex flex-col group dark:bg-[#292F3D] bg-[#FFFDFA] border-gray-200/60",
            statusColors[room.status],
            room.status === 'DEPOSITED' && "bg-orange-50/30"
        )}>
            <CardContent className="p-2 flex-1 flex flex-col">
                {/* Global Card Top: Room Basics */}
                <div className="flex justify-between items-start mb-1">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <h3 className="font-black text-base leading-none truncate tracking-tight">{room.roomName}</h3>
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
                                {room.status === 'AVAILABLE' && (
                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-green-500 hover:bg-green-600 text-white border-0">
                                        {t('rooms.status.AVAILABLE')}
                                    </Badge>
                                )}
                                {room.status === 'MAINTENANCE' && (
                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                                        {t('rooms.status.MAINTENANCE')}
                                    </Badge>
                                )}
                                {room.status === 'OCCUPIED' && (
                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-blue-500 hover:bg-blue-600 text-white border-0">
                                        {t('rooms.status.OCCUPIED')}
                                    </Badge>
                                )}
                                {(() => {
                                                    if (room.status === 'DEPOSITED' && room.activeContract?.startDate) {
                                                        const start = new Date(room.activeContract.startDate);
                                                        const now = new Date();
                                                        
                                                        // For short-term: compare precise time (including hours/minutes)
                                                        if (room.roomType === 'SHORT_TERM') {
                                                            const diffMs = start.getTime() - now.getTime();
                                                            const diffHours = diffMs / (1000 * 60 * 60);
                                                            
                                                            if (diffMs < 0) {
                                                                // Overdue - đã quá giờ check-in
                                                                return (
                                                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-red-500 hover:bg-red-600 text-white border-0 animate-pulse">
                                                                        {t('contracts.overdue')}
                                                                    </Badge>
                                                                );
                                                            } else if (diffHours <= 1) {
                                                                // Due very soon (within 1 hour)
                                                                return (
                                                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-orange-500 hover:bg-orange-600 text-white border-0">
                                                                        {t('contracts.dueToday')}
                                                                    </Badge>
                                                                );
                                                            } else if (diffHours <= 24) {
                                                                // Due today (within 24 hours)
                                                                return (
                                                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                                                                        {t('contracts.approaching')}
                                                                    </Badge>
                                                                );
                                                            }
                                                        } else {
                                                            // Long-term: compare by calendar days
                                                            const diffDays = differenceInCalendarDays(start, now);
                                                            
                                                            if (diffDays < 0) {
                                                                // Overdue - quá hạn
                                                                return (
                                                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-red-500 hover:bg-red-600 text-white border-0 animate-pulse">
                                                                        {t('contracts.overdue')}
                                                                    </Badge>
                                                                );
                                                            } else if (diffDays === 0) {
                                                                // Due today - đến hạn
                                                                return (
                                                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-orange-500 hover:bg-orange-600 text-white border-0">
                                                                        {t('contracts.dueToday')}
                                                                    </Badge>
                                                                );
                                                            } else if (diffDays <= 3) {
                                                                // Approaching - sắp đến hạn (within 3 days)
                                                                return (
                                                                    <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                                                                        {t('contracts.approaching')}
                                                                    </Badge>
                                                                );
                                                            }
                                                        }
                                                    }
                                                    return null;
                                                })()}
                                {/* Short-term OCCUPIED checkout badges */}
                                {(() => {
                                    if (room.status === 'OCCUPIED' && room.roomType === 'SHORT_TERM' && room.activeContract?.endDate) {
                                        const end = new Date(room.activeContract.endDate);
                                        const today = new Date();
                                        const diffCalendarDays = differenceInCalendarDays(end, today);
                                        const diffHours = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60));
                                        
                                        if (diffHours < 0) {
                                            // Overdue checkout
                                            return (
                                                <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-red-500 hover:bg-red-600 text-white border-0 animate-pulse">
                                                    {t('contracts.overdue')}
                                                </Badge>
                                            );
                                        } else if (diffCalendarDays <= 3) {
                                            // Approaching checkout (within 3 days)
                                            return (
                                                <Badge className="text-[10px] h-5 px-2 font-bold shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                                                    {t('contracts.approaching')}
                                                </Badge>
                                            );
                                        }
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/80 flex-wrap">
                            <span className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground/70">{room.roomCode}</span>
                            <span className="bg-primary/5 px-1 py-0.5 rounded italic whitespace-nowrap">{t('rooms.floor_display', { floor: room.floor })}</span>
                            {room.area ? (
                                <span className="bg-primary/5 px-1 py-0.5 rounded italic whitespace-nowrap">
                                    {room.area} m²
                                </span>
                            ) : null}
                            {room.maxOccupancy ? (
                                <span className="bg-primary/5 px-1 py-0.5 rounded italic whitespace-nowrap flex items-center gap-0.5">
                                    <User className="h-2.5 w-2.5" /> {room.maxOccupancy}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-3.5 w-3.5" />
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
              {room.status === 'DEPOSITED' && activeContract && (
                <DropdownMenuItem onClick={() => onActivateContract?.({
                    _id: activeContract._id,
                    startDate: activeContract.startDate || new Date().toISOString(),
                    endDate: activeContract.endDate,
                    paymentCycleMonths: activeContract.paymentCycleMonths,
                    paymentDueDay: activeContract.paymentDueDay
                })}>
                    <Zap className="mr-2 h-4 w-4" />
                    {t('contracts.activate')}
                </DropdownMenuItem>
            )}                        <DropdownMenuItem onClick={() => onEditContract?.(activeContract._id)}>
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

    // Only wrap in tooltip if there's content to show
    if (tooltipContent) {
        return (
            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {cardElement}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                        <p className="text-sm">{tooltipContent}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return cardElement;
}
