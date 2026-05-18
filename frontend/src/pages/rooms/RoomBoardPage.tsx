import { PageHeader } from '@/components/layout/page-shell';
import RoomBoardWorkspace from '@/components/rooms/RoomBoardWorkspace';
import { Button } from '@/components/ui/button';
import { DoorOpen, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function RoomBoardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="page-shell">
            <PageHeader
                eyebrow={t('common.operations', 'Vận hành')}
                title={t('dashboard.roomOverview', 'Quản trị phòng')}
                description={t(
                    'dashboard.roomOverviewPageDesc',
                    'Theo dõi trạng thái phòng, tạo hợp đồng và xử lý trực tiếp theo từng cụm phòng.',
                )}
                actions={
                    <>
                        <Button variant="outline" onClick={() => navigate('/rooms')}>
                            <DoorOpen className="mr-2 h-4 w-4" />
                            {t('rooms.title', 'Phòng')}
                        </Button>
                        <Button onClick={() => navigate('/contracts/new')}>
                            <FileText className="mr-2 h-4 w-4" />
                            {t('contracts.add')}
                        </Button>
                    </>
                }
            />

            <RoomBoardWorkspace />
        </div>
    );
}
