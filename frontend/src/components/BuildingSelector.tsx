import { useState, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
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
import { useBuildingStore } from '@/stores/buildingStore';
import apiClient from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ... (fetchBuildings stays same)
const fetchBuildings = async ({ pageParam = 1, search = '' }) => {
    const response = await apiClient.get(`/buildings?page=${pageParam}&limit=10&search=${search}`);
    return response.data;
};

// ... (Interface)
interface BuildingSelectorProps {
    value?: string | null;
    onSelect?: (buildingId: string | null) => void;
    showAllOption?: boolean;
    disabled?: boolean;
    error?: boolean;
}

export default function BuildingSelector({ value, onSelect, showAllOption = true, disabled, error }: BuildingSelectorProps) {
    const { t } = useTranslation();
    const { selectedBuildingId: storeSelectedBuildingId, setSelectedBuildingId: setStoreSelectedBuildingId } = useBuildingStore();

    // ... (rest of logic same until return)
    const selectedBuildingId = value !== undefined ? value : storeSelectedBuildingId;
    const setSelectedBuildingId = onSelect || setStoreSelectedBuildingId;

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
        queryKey: ['buildings', debouncedSearch],
        queryFn: ({ pageParam }) => fetchBuildings({ pageParam, search: debouncedSearch }),
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

    const buildings = data?.pages.flatMap((page: any) => page.data || []) || [];

    const { data: selectedBuildingData } = useQuery({
        queryKey: ['building', selectedBuildingId],
        queryFn: async () => {
            if (!selectedBuildingId) return null;
            try {
                const response = await apiClient.get(`/buildings/${selectedBuildingId}`);
                return response.data;
            } catch (err: any) {
                if (err.response?.status === 404) {
                    setSelectedBuildingId(null);
                }
                throw err;
            }
        },
        enabled: !!selectedBuildingId,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

    const selectedBuilding = buildings.find(b => b._id === selectedBuildingId) || selectedBuildingData;

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setSearchTerm('');
        }
    };

    return (
        <div className="flex items-center gap-2">
            {!onSelect && <Building2 className="hidden lg:block h-4 w-4 text-muted-foreground" />}
            <Popover open={open} onOpenChange={handleOpenChange} modal={true}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "h-10 justify-between font-normal px-3 transition-all duration-200 bg-card border-border rounded-lg",
                            onSelect ? "w-full" : "w-auto max-w-[140px] lg:max-w-[200px] lg:w-[200px]",
                            error && "border-destructive focus-visible:ring-destructive text-destructive"
                        )}
                        disabled={disabled || (isLoading && !buildings.length)}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedBuildingId ? (
                                selectedBuilding?.name ? (
                                    <span className="truncate text-xs lg:text-sm font-medium">
                                        {selectedBuilding.name}
                                    </span>
                                ) : (
                                    <Skeleton className="h-4 w-20 lg:w-28" />
                                )
                            ) : (
                                <span className="truncate text-xs lg:text-sm text-muted-foreground">
                                    {showAllOption ? t('common.allBuildings') : t('buildings.select')}
                                </span>
                            )}
                        </div>
                        <ChevronDown className="ml-1 lg:ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className={cn("p-0 overflow-hidden rounded-lg", onSelect ? "w-[--radix-popover-trigger-width]" : "w-[240px]")} align="end">
                    <Command shouldFilter={false} className="max-h-[350px]">
                        <CommandInput
                            placeholder={t('common.search')}
                            value={searchTerm}
                            onValueChange={setSearchTerm}
                        />
                        <CommandList className="scrollbar-thin">
                            {(isLoading && buildings.length === 0) ? (
                                <div className="p-4 space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-[80%]" />
                                    <Skeleton className="h-4 w-[90%]" />
                                </div>
                            ) : buildings.length === 0 && !isLoading ? (
                                <CommandEmpty className="py-6 text-center text-muted-foreground text-sm">
                                    {t('common.noBuildings')}
                                </CommandEmpty>
                            ) : null}
                            <CommandGroup>
                                {showAllOption && (
                                    <CommandItem
                                        value="all"
                                        onSelect={() => {
                                            setSelectedBuildingId(null);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                !selectedBuildingId ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="font-medium">{t('common.allBuildings')}</span>
                                    </CommandItem>
                                )}

                                {buildings.map((building: any) => (
                                    <CommandItem
                                        key={building._id}
                                        value={building._id}
                                        onSelect={() => {
                                            setSelectedBuildingId(building._id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedBuildingId === building._id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {building.name}
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
        </div>
    );
}

