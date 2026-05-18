import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OverdueBannerProps {
    count: number;
    onOpen: () => void;
}

export default function OverdueBanner({ count, onOpen }: OverdueBannerProps) {
    const { t } = useTranslation();
    if (count === 0) return null;
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-error/30 bg-error/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-error">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="font-semibold">{t('calendar.overdue.bannerCount', { count })}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onOpen} className="border-error/40 text-error hover:bg-error/15">
                {t('calendar.overdue.viewAll', 'Xem chi tiết')}
                <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
        </div>
    );
}
