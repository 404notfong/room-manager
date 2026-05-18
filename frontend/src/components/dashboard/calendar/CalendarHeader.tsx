import { Button } from '@/components/ui/button';
import { format, type Locale } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CalendarHeaderProps {
    currentMonth: Date;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    locale: Locale;
}

export default function CalendarHeader({ currentMonth, onPrev, onNext, onToday, locale }: CalendarHeaderProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar sm:justify-end">
                <Button variant="outline" size="sm" onClick={onToday}>
                    {t('calendar.today', 'Hôm nay')}
                </Button>
                <div className="flex items-center rounded-2xl border border-border/70 bg-background/80 p-1 shadow-sm">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onPrev} aria-label={t('common.previousMonth', 'Tháng trước')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[152px] px-3 text-center text-sm font-semibold capitalize text-foreground">
                        {format(currentMonth, 'MMMM yyyy', { locale })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onNext} aria-label={t('common.nextMonth', 'Tháng sau')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
