import type { CalendarEvent } from '@/api/calendar';
import { buildMonthGrid } from '@/lib/calendar/grid-helpers';
import { format, isToday, type Locale } from 'date-fns';
import { useMemo } from 'react';
import CalendarDayCell from './CalendarDayCell';

interface CalendarGridProps {
    currentMonth: Date;
    eventsByDay: Record<string, CalendarEvent[]>;
    onDayClick: (day: Date) => void;
    locale: Locale;
}

export default function CalendarGrid({ currentMonth, eventsByDay, onDayClick, locale }: CalendarGridProps) {
    const weekdays = useMemo(
        () => Array.from({ length: 7 }, (_, i) => format(new Date(2026, 0, 5 + i), 'EEE', { locale })),
        [locale],
    );
    const cells = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

    return (
        <div className="overflow-x-auto hide-scrollbar">
            <div className="min-w-[680px] rounded-[1.35rem] border border-border/70 bg-background/65 p-3">
                <div className="mb-2 grid grid-cols-7 gap-2">
                    {weekdays.map((d) => (
                        <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {cells.map(({ date, isCurrentMonth }) => {
                        const key = format(date, 'yyyy-MM-dd');
                        const events = eventsByDay[key] ?? [];
                        return (
                            <CalendarDayCell
                                key={key}
                                day={date}
                                events={events}
                                isToday={isToday(date)}
                                isOutsideMonth={!isCurrentMonth}
                                onClick={() => onDayClick(date)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
