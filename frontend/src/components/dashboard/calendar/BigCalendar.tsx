import { addMonths, subMonths } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from '@/api/calendar';
import { getRelatedPath } from '@/lib/calendar/event-display';
import CalendarDayDetailModal from './CalendarDayDetailModal';
import CalendarGrid from './CalendarGrid';
import CalendarHeader from './CalendarHeader';
import OverdueBanner from './OverdueBanner';
import OverdueListModal from './OverdueListModal';
import { useCalendarData } from './hooks/useCalendarData';

interface BigCalendarProps {
    buildingId?: string;
}

export default function BigCalendar({ buildingId }: BigCalendarProps) {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isDayModalOpen, setIsDayModalOpen] = useState(false);
    const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);

    const locale = i18n.language === 'en' ? enUS : vi;

    const { eventsByDay, dayEventsQuery, overdueQuery } = useCalendarData({
        currentMonth,
        selectedDate,
        buildingId,
        isDayModalOpen,
    });

    const handleDayClick = (day: Date) => {
        setSelectedDate(day);
        setIsDayModalOpen(true);
    };

    const handleViewEvent = (event: CalendarEvent) => {
        setIsDayModalOpen(false);
        setIsOverdueModalOpen(false);
        navigate(getRelatedPath(event));
    };

    return (
        <>
            <div className="space-y-4">
                <OverdueBanner
                    count={overdueQuery.data?.length ?? 0}
                    onOpen={() => setIsOverdueModalOpen(true)}
                />
                <CalendarHeader
                    currentMonth={currentMonth}
                    onPrev={() => setCurrentMonth((d) => subMonths(d, 1))}
                    onNext={() => setCurrentMonth((d) => addMonths(d, 1))}
                    onToday={() => setCurrentMonth(new Date())}
                    locale={locale}
                />
                <CalendarGrid
                    currentMonth={currentMonth}
                    eventsByDay={eventsByDay}
                    onDayClick={handleDayClick}
                    locale={locale}
                />
            </div>

            <CalendarDayDetailModal
                isOpen={isDayModalOpen}
                onClose={() => setIsDayModalOpen(false)}
                selectedDate={selectedDate}
                events={dayEventsQuery.data?.events ?? []}
                isLoading={dayEventsQuery.isLoading}
                onViewEvent={handleViewEvent}
                locale={locale}
            />

            <OverdueListModal
                isOpen={isOverdueModalOpen}
                onClose={() => setIsOverdueModalOpen(false)}
                events={overdueQuery.data ?? []}
                onViewEvent={handleViewEvent}
            />
        </>
    );
}
