import type { CalendarEvent } from '@/api/calendar';
import { calendarApi } from '@/api/calendar';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useMemo } from 'react';

interface UseCalendarDataArgs {
    currentMonth: Date;
    selectedDate: Date | null;
    buildingId?: string;
    isDayModalOpen?: boolean;
}

export function useCalendarData({ currentMonth, selectedDate, buildingId, isDayModalOpen }: UseCalendarDataArgs) {
    const start = useMemo(() => startOfMonth(currentMonth).toISOString(), [currentMonth]);
    const end = useMemo(() => endOfMonth(currentMonth).toISOString(), [currentMonth]);

    const eventsQuery = useQuery({
        queryKey: ['calendar-events', start, end, buildingId],
        queryFn: () => calendarApi.getEvents(start, end, buildingId),
    });

    const dayEventsQuery = useQuery({
        queryKey: ['calendar-day', selectedDate?.toISOString(), buildingId],
        queryFn: () => calendarApi.getDayEvents(selectedDate!.toISOString(), buildingId),
        enabled: !!selectedDate && !!isDayModalOpen,
    });

    const overdueQuery = useQuery({
        queryKey: ['calendar-overdue', buildingId],
        queryFn: () => calendarApi.getOverdue(buildingId),
    });

    const eventsByDay = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        for (const event of eventsQuery.data ?? []) {
            const key = format(new Date(event.date), 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(event);
        }
        return map;
    }, [eventsQuery.data]);

    return { eventsQuery, eventsByDay, dayEventsQuery, overdueQuery };
}
