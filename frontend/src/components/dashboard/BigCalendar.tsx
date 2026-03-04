import { calendarApi, CalendarEvent, CalendarMonthSummary } from '@/api/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    isToday,
    startOfMonth,
    subMonths
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface BigCalendarProps {
    buildingId?: string;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    CONTRACT_START: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    CONTRACT_END: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    
    // Deposit check-in events
    DEPOSIT_CHECKIN_DUE: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
    DEPOSIT_CHECKIN_OVERDUE: { bg: 'bg-red-200', text: 'text-red-800', dot: 'bg-red-600' },
    
    // Active checkout events
    ACTIVE_CHECKOUT_DUE: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
    ACTIVE_CHECKOUT_OVERDUE: { bg: 'bg-rose-200', text: 'text-rose-800', dot: 'bg-rose-700' },
    
    INVOICE_DUE: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    INVOICE_OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    PAYMENT_DUE: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
    PAYMENT_DUE_OVERDUE: { bg: 'bg-red-200', text: 'text-red-800', dot: 'bg-red-600' },
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function BigCalendar({ buildingId }: BigCalendarProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;

    // Fetch month summary for the calendar dots
    const { data: monthSummary } = useQuery<CalendarMonthSummary>({
        queryKey: ['calendar-summary', year, month, buildingId],
        queryFn: () => calendarApi.getMonthSummary(year, month, buildingId),
    });

    // Fetch events for selected day
    const { data: dayEvents, isLoading: isDayLoading } = useQuery<{ events: CalendarEvent[] }>({
        queryKey: ['calendar-day', selectedDate?.toISOString(), buildingId],
        queryFn: () => calendarApi.getDayEvents(selectedDate!.toISOString(), buildingId),
        enabled: !!selectedDate && isModalOpen,
    });

    const handlePrevMonth = () => setCurrentMonth((d) => subMonths(d, 1));
    const handleNextMonth = () => setCurrentMonth((d) => addMonths(d, 1));
    const handleToday = () => setCurrentMonth(new Date());

    const handleDayClick = (day: Date) => {
        setSelectedDate(day);
        setIsModalOpen(true);
    };

    const handleViewEvent = (event: CalendarEvent) => {
        setIsModalOpen(false);
        if (event.relatedType === 'contract') {
            navigate(`/contracts?view=${event.relatedId}`);
        } else if (event.relatedType === 'invoice') {
            navigate(`/invoices?view=${event.relatedId}`);
        }
    };

    // Generate calendar grid
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Calculate padding for first week (Monday = 0, Sunday = 6)
    const startDayOffset = (getDay(monthStart) + 6) % 7;
    const paddingDays = Array(startDayOffset).fill(null);

    // Get events for a specific date
    const getEventsForDate = (date: Date): string[] => {
        if (!monthSummary?.days) return [];
        const dateKey = format(date, 'yyyy-MM-dd');
        const dayData = monthSummary.days[dateKey];
        if (!dayData) return [];
        return Object.entries(dayData)
            .filter(([, count]) => count > 0)
            .map(([type]) => type);
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        {t('calendar.title')}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleToday}>
                            {t('calendar.today')}
                        </Button>
                        <div className="flex items-center">
                            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="w-36 text-center font-medium">
                                {format(currentMonth, 'MMMM yyyy', { locale: vi })}
                            </span>
                            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map((day) => (
                        <div
                            key={day}
                            className="text-center text-xs font-medium text-muted-foreground py-2"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 border-l border-t border-border">
                    {/* Padding for first week */}
                    {paddingDays.map((_, i) => (
                        <div key={`pad-${i}`} className="h-24 border-r border-b border-border bg-muted/30" />
                    ))}

                    {/* Actual days */}
                    {days.map((day) => {
                        const eventTypes = getEventsForDate(day);
                        const hasEvents = eventTypes.length > 0;

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => handleDayClick(day)}
                                className={`
                                    h-24 p-2 text-left transition-colors border-r border-b border-border
                                    hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset
                                    ${isToday(day) ? 'bg-primary/10' : 'bg-background'}
                                    ${hasEvents ? 'cursor-pointer' : 'cursor-default'}
                                `}
                            >
                                <span
                                    className={`
                                        text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full
                                        ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}
                                    `}
                                >
                                    {format(day, 'd')}
                                </span>

                                {/* Event dots */}
                                {hasEvents && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {eventTypes.slice(0, 3).map((type) => (
                                            <span
                                                key={type}
                                                className={`w-2 h-2 rounded-full ${EVENT_COLORS[type]?.dot || 'bg-gray-400'}`}
                                                title={t(`calendar.eventTypes.${type}`)}
                                            />
                                        ))}
                                        {eventTypes.length > 3 && (
                                            <span className="text-xs text-muted-foreground">
                                                +{eventTypes.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                    {Object.entries(EVENT_COLORS).map(([type, colors]) => (
                        <div key={type} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                            <span className="text-muted-foreground">
                                {t(`calendar.eventTypes.${type}`)}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>

            {/* Day Events Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            {selectedDate && format(selectedDate, 'EEEE, dd/MM/yyyy', { locale: vi })}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {isDayLoading && (
                            <div className="text-center py-4 text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        )}

                        {!isDayLoading && (!dayEvents?.events || dayEvents.events.length === 0) && (
                            <div className="text-center py-4 text-muted-foreground">
                                {t('calendar.noEvents')}
                            </div>
                        )}

                        {dayEvents?.events?.map((event) => {
                            const colors = EVENT_COLORS[event.type] || { bg: 'bg-gray-100', text: 'text-gray-700' };

                            return (
                                <div
                                    key={event._id}
                                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            {/* Event Type Badge */}
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} mb-2`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[event.type]?.dot || 'bg-gray-400'}`} />
                                                {t(`calendar.eventTypes.${event.type}`)}
                                            </span>
                                            
                                            {/* Title */}
                                            <p className="font-semibold text-foreground">{event.title}</p>
                                            
                                            {/* Details Grid */}
                                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                                {event.buildingName && event.buildingName !== 'N/A' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground/70">Tòa nhà:</span>
                                                        <span className="font-medium text-foreground">{event.buildingName}</span>
                                                    </div>
                                                )}
                                                {event.roomName && event.roomName !== 'N/A' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground/70">Phòng:</span>
                                                        <span className="font-medium text-foreground">{event.roomName}</span>
                                                    </div>
                                                )}
                                                {event.tenantName && event.tenantName !== 'N/A' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground/70">Khách thuê:</span>
                                                        <span className="font-medium text-foreground">{event.tenantName}</span>
                                                    </div>
                                                )}
                                                {event.amount && event.amount > 0 && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground/70">Số tiền:</span>
                                                        <span className="font-semibold text-orange-600">{event.amount.toLocaleString('vi-VN')} VND</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-shrink-0"
                                            onClick={() => handleViewEvent(event)}
                                        >
                                            <ExternalLink className="h-4 w-4 mr-1" />
                                            {event.relatedType === 'contract' ? t('calendar.viewContract') : t('calendar.viewInvoice')}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
