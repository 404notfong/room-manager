import { useState, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { User, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import apiClient from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import { cn, formatPhoneNumber } from '@/lib/utils';

const fetchTenants = async ({ pageParam = 1, search = '' }) => {
    const response = await apiClient.get(`/tenants?page=${pageParam}&limit=10&search=${search}&status=ACTIVE`);
    return response.data;
};

interface TenantSelectorProps {
    value?: string | null;
    onSelect: (tenantId: string | null) => void;
    disabled?: boolean;
    error?: boolean;
}

export default function TenantSelector({ value, onSelect, disabled, error }: TenantSelectorProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useInfiniteQuery({
        queryKey: ['tenants', debouncedSearch, 'ACTIVE'],
        queryFn: ({ pageParam }) => fetchTenants({ pageParam, search: debouncedSearch }),
        getNextPageParam: (lastPage: any) => {
            if (lastPage?.meta) {
                return lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined;
            }
            return undefined;
        },
        initialPageParam: 1,
    });

    const observer = useRef<IntersectionObserver>();
    const lastElementRef = (node: HTMLDivElement) => {
        if (isLoading || isFetchingNextPage) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        }, {
            threshold: 0,
            rootMargin: '100px'
        });

        if (node) observer.current.observe(node);
    };

    const tenants = data?.pages.flatMap((page: any) => page.data || []) || [];

    // Separate query for current tenant to ensure name is always visible
    const { data: selectedTenantData } = useQuery({
        queryKey: ['tenant', value],
        queryFn: async () => {
            if (!value) return null;
            const response = await apiClient.get(`/tenants/${value}`);
            return response.data;
        },
        enabled: !!value,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

    const selectedTenant = tenants.find(t => t._id === value) || selectedTenantData;

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setSearchTerm('');
        }
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full h-10 justify-between font-normal px-3 bg-white dark:bg-slate-900",
                        error && "border-destructive focus-visible:ring-destructive"
                    )}
                    disabled={disabled}
                >
                    <div className="flex items-center gap-2 truncate">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                            {value
                                ? selectedTenant ? `${selectedTenant.fullName}${selectedTenant.phone ? ` - ${formatPhoneNumber(selectedTenant.phone)}` : ''}` : t('common.loading')
                                : t('contracts.selectTenant')}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={t('common.search')}
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                    />
                    <CommandList>
                        <CommandEmpty>{isLoading ? t('common.loading') : t('common.noData')}</CommandEmpty>
                        <CommandGroup>
                            {tenants.map((tenant: any) => (
                                <CommandItem
                                    key={tenant._id}
                                    value={tenant._id}
                                    onSelect={() => {
                                        onSelect(tenant._id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === tenant._id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{tenant.fullName}</span>
                                        {tenant.phone && (
                                            <span className="text-xs text-muted-foreground">{formatPhoneNumber(tenant.phone)}</span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        {hasNextPage && (
                            <div
                                ref={lastElementRef}
                                className="p-4 flex justify-center items-center min-h-[40px]"
                            >
                                {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            </div>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
