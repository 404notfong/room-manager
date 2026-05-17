import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import ContractForm from './ContractForm';

export default function ContractEditPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [headerButtons, setHeaderButtons] = useState<React.ReactNode>(null);

    const { data: contract, isLoading, isError } = useQuery({
        queryKey: ['contract', id],
        queryFn: async () => {
            const response = await apiClient.get(`/contracts/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isError || !contract) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">{t('common.notFound', 'Không tìm thấy')}</h1>
                </div>
                <p className="text-muted-foreground">{t('contracts.notFoundMessage', 'Hợp đồng không tồn tại hoặc đã bị xóa.')}</p>
            </div>
        );
    }

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
                            {t('contracts.editTitle')}
                        </h1>
                        <p className="text-muted-foreground">{contract.contractCode}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {headerButtons}
                </div>
            </div>

            <ContractForm
                contract={contract}
                onSuccess={() => navigate('/contracts')}
                formId="contract-form"
                renderHeaderButtons={setHeaderButtons}
            />
        </div>
    );
}
