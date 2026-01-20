import { useTranslation } from 'react-i18next';
import { Settings2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnConfig } from '@/hooks/useColumnVisibility';

interface ColumnVisibilityToggleProps {
    columns: ColumnConfig[];
    isVisible: (columnId: string) => boolean;
    toggle: (columnId: string) => void;
    reset: () => void;
    showAll: () => void;
    hideAll: () => void;
}

export function ColumnVisibilityToggle({
    columns,
    isVisible,
    toggle,
    reset,
    showAll,
    hideAll,
}: ColumnVisibilityToggleProps) {
    const { t } = useTranslation();

    const visibleCount = columns.filter((col) => isVisible(col.id)).length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    {t('common.columns')}
                    <span className="text-xs text-muted-foreground">
                        ({visibleCount}/{columns.length})
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('common.toggleColumns')}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Quick actions */}
                <div className="flex gap-1 px-2 py-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={showAll}
                    >
                        <Eye className="h-3 w-3 mr-1" />
                        {t('common.showAll')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={hideAll}
                    >
                        <EyeOff className="h-3 w-3 mr-1" />
                        {t('common.hideAll')}
                    </Button>
                </div>

                <DropdownMenuSeparator />

                {/* Column checkboxes */}
                {columns.map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={isVisible(column.id)}
                        onCheckedChange={() => toggle(column.id)}
                    >
                        {column.label}
                    </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />

                {/* Reset button */}
                <div className="px-2 py-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={reset}
                    >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {t('common.resetColumns')}
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
