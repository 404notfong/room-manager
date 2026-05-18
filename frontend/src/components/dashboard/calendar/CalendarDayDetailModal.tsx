import type { CalendarEvent } from '@/api/calendar';
import { CompactEmptyState, LoadingState } from '@/components/layout/page-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, type Locale } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CalendarEventCard from './CalendarEventCard';

interface CalendarDayDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    events: CalendarEvent[];
    isLoading: boolean;
    onViewEvent: (event: CalendarEvent) => void;
    locale: Locale;
}

export default function CalendarDayDetailModal({
    isOpen, onClose, selectedDate, events, isLoading, onViewEvent, locale,
}: CalendarDayDetailModalProps) {
    const { t } = useTranslation();
    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl rounded-[1.5rem] border-border/70">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        {selectedDate && format(selectedDate, 'EEEE, dd/MM/yyyy', { locale })}
                    </DialogTitle>
                </DialogHeader>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {isLoading ? (
                        <LoadingState compact description={t('calendar.loadingEvents', 'Đang tải sự kiện')} />
                    ) : events.length === 0 ? (
                        <CompactEmptyState
                            icon={CalendarDays}
                            title={t('calendar.noEventsTitle', 'Không có sự kiện')}
                            description={t('calendar.noEvents', 'Không có sự kiện')}
                            className="py-8"
                        />
                    ) : (
                        events.map((event) => (
                            <CalendarEventCard key={event._id} event={event} onView={onViewEvent} />
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
