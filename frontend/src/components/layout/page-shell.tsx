import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpDown, Loader2, Search, X, type LucideIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
    className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
    return (
        <section className={cn('page-intro', className)}>
            <div className="page-intro-copy">
                {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
                <div className="space-y-2">
                    <h1 className="page-title">{title}</h1>
                    {description ? <p className="page-description">{description}</p> : null}
                </div>
            </div>
            {actions ? <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div> : null}
        </section>
    );
}

interface DetailPageHeaderProps {
    eyebrow?: string;
    title: string;
    description?: ReactNode;
    icon?: LucideIcon;
    leading?: ReactNode;
    actions?: ReactNode;
    onBack?: () => void;
    backLabel?: string;
    className?: string;
}

export function DetailPageHeader({
    eyebrow,
    title,
    description,
    icon: Icon,
    leading,
    actions,
    onBack,
    backLabel,
    className,
}: DetailPageHeaderProps) {
    return (
        <section className={cn('page-intro gap-4 lg:gap-5', className)}>
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                {onBack ? (
                    <Button
                        variant="outline"
                        size="icon"
                        className="mt-0.5 h-9 w-9 shrink-0 rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl"
                        onClick={onBack}
                        aria-label={backLabel}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                ) : null}
                {leading ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10">
                        {leading}
                    </div>
                ) : Icon ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10 sm:rounded-2xl">
                        <Icon className="h-5 w-5" />
                    </div>
                ) : null}
                <div className="min-w-0 space-y-1">
                    {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">{title}</h1>
                        {description ? <div className="max-w-2xl text-sm leading-5 text-muted-foreground sm:text-[15px]">{description}</div> : null}
                    </div>
                </div>
            </div>
            {actions ? <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div> : null}
        </section>
    );
}

export function FilterBar({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <section className={cn('toolbar-panel', className)}>{children}</section>;
}

interface ListWorkspaceProps {
    summary?: ReactNode;
    controls?: ReactNode;
    activeFilters?: ReactNode;
    secondaryControls?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    contentClassName?: string;
}

function hasRenderableContent(node: ReactNode): boolean {
    if (node == null || node === false || node === true || node === '') return false;
    if (Array.isArray(node)) return node.some(hasRenderableContent);
    if (isValidElement(node) && node.type === Fragment) {
        return hasRenderableContent((node.props as { children?: ReactNode }).children);
    }
    return Children.toArray(node).some((child) => {
        if (isValidElement(child) && child.type === Fragment) {
            return hasRenderableContent((child.props as { children?: ReactNode }).children);
        }
        return child != null && child !== false && child !== '';
    });
}

export function ListWorkspace({
    summary,
    controls,
    activeFilters,
    secondaryControls,
    children,
    footer,
    className,
    contentClassName,
}: ListWorkspaceProps) {
    const hasActiveFilters = hasRenderableContent(activeFilters);
    const hasSecondaryControls = hasRenderableContent(secondaryControls);
    const isCompactToolbar = !hasActiveFilters && !hasSecondaryControls;

    return (
        <Card
            className={cn('list-workspace min-w-0', className)}
            data-toolbar-compact={isCompactToolbar ? 'true' : 'false'}
        >
            {summary || controls ? (
                <CardContent className="space-y-5 p-5 pb-0 md:p-6 md:pb-0">
                    <div className="list-workspace-toolbar">
                        {controls ? <div className="list-workspace-controls">{controls}</div> : null}
                        {summary ? <div className="list-workspace-summary">{summary}</div> : null}
                    </div>
                    {hasActiveFilters ? <div className="workspace-filter-chips">{activeFilters}</div> : null}
                    {hasSecondaryControls ? <div className="workspace-secondary-controls">{secondaryControls}</div> : null}
                </CardContent>
            ) : null}
            <CardContent className={cn('min-w-0 p-0', contentClassName)}>{children}</CardContent>
            {footer ? <div className="desktop-list-pagination px-4 pb-2">{footer}</div> : null}
        </Card>
    );
}

export function WorkspaceCountChip({
    count,
    label,
    className,
}: {
    count: number | string;
    label: string;
    className?: string;
}) {
    return (
        <span className={cn('workspace-count-chip', className)}>
            <span className="tabular-nums">{count}</span>
            <span>{label}</span>
        </span>
    );
}

export function WorkspaceFilterChip({
    children,
    icon: Icon,
    onClear,
    clearLabel,
    className,
}: {
    children: ReactNode;
    icon?: LucideIcon;
    onClear?: () => void;
    clearLabel?: string;
    className?: string;
}) {
    if (onClear) {
        return (
            <button
                type="button"
                onClick={onClear}
                className={cn('workspace-filter-chip workspace-filter-chip-action', className)}
                aria-label={clearLabel}
            >
                {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                <span className="truncate">{children}</span>
                <X className="h-3.5 w-3.5" />
            </button>
        );
    }

    return (
        <span className={cn('workspace-filter-chip', className)}>
            {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
            <span className="truncate">{children}</span>
        </span>
    );
}

export function WorkspaceSortChip({
    label,
    directionLabel,
    prefix,
    onClear,
    clearLabel,
    className,
}: {
    label: string;
    directionLabel: string;
    prefix: string;
    onClear: () => void;
    clearLabel: string;
    className?: string;
}) {
    return (
        <WorkspaceFilterChip
            icon={ArrowUpDown}
            onClear={onClear}
            clearLabel={clearLabel}
            className={className}
        >
            {`${prefix}: ${label} · ${directionLabel}`}
        </WorkspaceFilterChip>
    );
}

export function WorkspaceSearchInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    ariaLabel: string;
    className?: string;
}) {
    return (
        <div className={cn('relative min-w-0 flex-1 sm:min-w-[280px] xl:max-w-[340px] xl:flex-none', className)}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={ariaLabel}
                className="pl-9"
            />
        </div>
    );
}

export function WorkspaceSegmentedFilters<T extends string>({
    options,
    value,
    onChange,
    className,
}: {
    options: ReadonlyArray<{ value: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div className={cn('workspace-segmented-row', className)}>
            {options.map((option) => (
                <Button
                    key={option.value}
                    variant={value === option.value ? 'default' : 'outline'}
                    onClick={() => onChange(option.value)}
                    className="h-8 rounded-full px-3 text-xs shadow-none"
                >
                    {option.label}
                </Button>
            ))}
        </div>
    );
}

interface DataPanelProps {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}

export function DataPanel({
    title,
    description,
    actions,
    children,
    className,
    contentClassName,
}: DataPanelProps) {
    const isDesktopListPanel = className?.includes('desktop-list-panel');

    return (
        <Card className={cn('surface-card min-w-0', isDesktopListPanel && 'lg:overflow-visible', className)}>
            <CardHeader className={cn('surface-header', !actions && 'surface-header-static')}>
                <div className="surface-heading">
                    <CardTitle className="surface-title">{title}</CardTitle>
                    {description ? <CardDescription className="surface-description">{description}</CardDescription> : null}
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </CardHeader>
            <CardContent className={cn('min-w-0 p-0', isDesktopListPanel && 'flex min-h-0 flex-1 flex-col overflow-visible', contentClassName)}>{children}</CardContent>
        </Card>
    );
}

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-4 px-6 py-14 text-center',
                className,
            )}
        >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {action ? <div className="pt-1">{action}</div> : null}
        </div>
    );
}

export function CompactEmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center',
                className,
            )}
        >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
                {description ? <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
            </div>
            {action ? <div className="pt-1">{action}</div> : null}
        </div>
    );
}

export function LoadingState({
    title,
    description,
    className,
    compact = false,
}: {
    title?: string;
    description?: string;
    className?: string;
    compact?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 text-center',
                compact ? 'px-4 py-10' : 'px-6 py-20',
                className,
            )}
        >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            {title || description ? (
                <div className="space-y-1">
                    {title ? <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3> : null}
                    {description ? <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
                </div>
            ) : null}
        </div>
    );
}

export function InlineLoadingState({
    label,
    className,
}: {
    label?: string;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center justify-center gap-2 px-4 py-3 text-sm text-muted-foreground', className)}>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {label ? <span>{label}</span> : null}
        </div>
    );
}

export function NotFoundState({
    title,
    description,
    action,
    className,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <CompactEmptyState
            icon={Search}
            title={title}
            description={description || ''}
            action={action}
            className={className}
        />
    );
}

export function ListLoadingState({
    rows = 6,
    className,
}: {
    rows?: number;
    className?: string;
}) {
    return (
        <div className={cn('p-4', className)}>
            <div className="space-y-4 md:hidden">
                {Array.from({ length: Math.min(rows, 4) }).map((_, index) => (
                    <div key={`mobile-card-${index}`} className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-5 w-32 rounded-lg" />
                                <Skeleton className="h-4 w-24 rounded-lg" />
                            </div>
                            <Skeleton className="h-9 w-9 rounded-xl" />
                        </div>
                        <div className="mt-4 space-y-2 border-t border-border/70 pt-4">
                            <Skeleton className="h-4 w-full rounded-lg" />
                            <Skeleton className="h-4 w-2/3 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden md:block">
                <div className="overflow-hidden rounded-[1.2rem] border border-border/70 bg-background/85">
                    <div className="grid grid-cols-6 gap-4 border-b border-border/70 bg-muted/35 px-4 py-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={`head-${index}`} className="h-4 rounded-lg" />
                        ))}
                    </div>
                    <div className="divide-y divide-border/70">
                        {Array.from({ length: rows }).map((_, index) => (
                            <div key={`row-${index}`} className="grid grid-cols-6 gap-4 px-4 py-4">
                                {Array.from({ length: 6 }).map((__, cellIndex) => (
                                    <Skeleton
                                        key={`cell-${index}-${cellIndex}`}
                                        className={cn('h-4 rounded-lg', cellIndex === 0 ? 'w-24' : cellIndex === 5 ? 'ml-auto w-20' : 'w-full')}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface MetricCardProps {
    title: string;
    value: string;
    description: string;
    icon: LucideIcon;
    accentClassName?: string;
}

export function MetricCard({
    title,
    value,
    description,
    icon: Icon,
    accentClassName,
}: MetricCardProps) {
    return (
        <Card className="metric-card">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="font-display text-3xl font-semibold tracking-tight text-foreground">{value}</div>
                    </div>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary', accentClassName)}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </Card>
    );
}
