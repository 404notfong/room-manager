import { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import ContractForm from './ContractForm';

export default function ContractCreatePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preSelectedRoomId = searchParams.get('roomId') || undefined;
    const [headerButtons, setHeaderButtons] = useState<React.ReactNode>(null);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <FileText className="h-7 w-7" />
                            {t('contracts.createTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('contracts.createDescription', 'Tạo hợp đồng mới')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {headerButtons}
                </div>
            </div>

            <ContractForm
                preSelectedRoomId={preSelectedRoomId}
                onSuccess={() => navigate('/contracts')}
                formId="contract-form"
                renderHeaderButtons={setHeaderButtons}
            />
        </div>
    );
}
