import type { CalendarEvent } from '@/api/calendar';
import { Button } from '@/components/ui/button';
import { EVENT_COLORS } from '@/lib/calendar/event-colors';
import { composeEventTitle, composeEventDescription } from '@/lib/calendar/event-display';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SEVERITY_BORDER_CLASS: Record<string, string> = {
    danger: 'border-l-error',
    warning: 'border-l-warning',
    info: 'border-l-info',
};

interface CalendarEventCardProps {
    event: CalendarEvent;
    onView?: (event: CalendarEvent) => void;
}

export default function CalendarEventCard({ event, onView }: CalendarEventCardProps) {
    const { t, i18n } = useTranslation();
    const colors = EVENT_COLORS[event.type];
    const borderClass = SEVERITY_BORDER_CLASS[event.severity] ?? 'border-l-info';
    const ctaLabel = event.relatedType === 'contract'
        ? t('calendar.viewContract', 'Xem hợp đồng')
        : t('calendar.viewInvoice', 'Xem hóa đơn');

    const metaItems: Array<{ label: string; value: string }> = [];
    if (event.buildingName && event.buildingName !== 'N/A') {
        metaItems.push({ label: t('buildings.label', 'Tòa nhà'), value: event.buildingName });
    }
    if (event.roomName && event.roomName !== 'N/A') {
        metaItems.push({ label: t('rooms.room', 'Phòng'), value: event.roomName });
    }
    if (event.tenantName && event.tenantName !== 'N/A') {
        metaItems.push({ label: t('dashboard.tenant', 'Khách thuê'), value: event.tenantName });
    }

    return (
        <div className={`rounded-2xl border border-border/70 bg-background/80 p-4 border-l-[4px] ${borderClass}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <span className={['inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', colors.shell].join(' ')}>
                        <span className={['h-2 w-2 rounded-full', colors.dot].join(' ')} />
                        {t(`calendar.eventTypes.${event.type}`)}
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{composeEventTitle(event, t)}</p>
                        {composeEventDescription(event, i18n.language) ? (
                            <p className="mt-1 text-sm text-muted-foreground">{composeEventDescription(event, i18n.language)}</p>
                        ) : null}
                    </div>
                    {metaItems.length > 0 ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {metaItems.map((m) => (
                                <span key={m.label}>{m.label}: <strong className="text-foreground">{m.value}</strong></span>
                            ))}
                        </div>
                    ) : null}
                </div>
                {onView ? (
                    <Button variant="outline" size="sm" onClick={() => onView(event)}>
                        <ExternalLink className="mr-1 h-4 w-4" />
                        {ctaLabel}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
