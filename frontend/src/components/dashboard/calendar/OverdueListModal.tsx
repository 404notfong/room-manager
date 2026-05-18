import type { CalendarEvent } from '@/api/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CalendarEventCard from './CalendarEventCard';

interface OverdueListModalProps {
    isOpen: boolean;
    onClose: () => void;
    events: CalendarEvent[];
    onViewEvent: (event: CalendarEvent) => void;
}

export default function OverdueListModal({ isOpen, onClose, events, onViewEvent }: OverdueListModalProps) {
    const { t } = useTranslation();
    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl rounded-[1.5rem] border-border/70">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-error">
                        <AlertTriangle className="h-5 w-5" />
                        {t('calendar.overdue.modalTitle', 'Sự kiện quá hạn')}
                    </DialogTitle>
                </DialogHeader>
                <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {events.map((e) => (
                        <CalendarEventCard key={e._id} event={e} onView={onViewEvent} />
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
