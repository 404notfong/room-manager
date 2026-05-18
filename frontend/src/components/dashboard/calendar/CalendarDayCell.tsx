import type { CalendarEvent } from '@/api/calendar';
import { EVENT_COLORS } from '@/lib/calendar/event-colors';
import { composeEventBarLabel } from '@/lib/calendar/event-display';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface CalendarDayCellProps {
    day: Date;
    events: CalendarEvent[];
    isToday: boolean;
    isOutsideMonth: boolean;
    onClick: () => void;
}

const MAX_VISIBLE_BARS = 4;

export default function CalendarDayCell({ day, events, isToday, isOutsideMonth, onClick }: CalendarDayCellProps) {
    const { t } = useTranslation();
    const hasEvents = events.length > 0;
    const visible = events.slice(0, MAX_VISIBLE_BARS);
    const overflow = events.length - visible.length;

    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'min-h-[88px] rounded-2xl border border-border/70 p-2.5 text-left transition-colors lg:min-h-[92px] xl:min-h-[88px]',
                hasEvents ? 'hover:bg-accent/55' : 'hover:bg-muted/45',
                isToday ? 'bg-primary/[0.08]' : 'bg-background/88',
                isOutsideMonth ? 'opacity-45' : '',
            ].join(' ')}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={[
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                    isToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                ].join(' ')}>
                    {format(day, 'd')}
                </span>
                {hasEvents ? (
                    <span className="text-[11px] font-semibold text-muted-foreground">{events.length}</span>
                ) : null}
            </div>

            {hasEvents ? (
                <div className="mt-2 space-y-1">
                    {visible.map((event) => (
                        <span
                            key={event._id}
                            className={[
                                'block truncate whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-medium',
                                EVENT_COLORS[event.type].bar,
                            ].join(' ')}
                            title={composeEventBarLabel(event, t)}
                        >
                            {composeEventBarLabel(event, t)}
                        </span>
                    ))}
                    {overflow > 0 ? (
                        <span className="inline-flex rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            +{overflow} {t('common.more', 'nữa')}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </button>
    );
}
