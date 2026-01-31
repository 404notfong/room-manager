import { useState, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface RoomSelectorProps {
    buildingId: string;
    value?: string;
    onSelect: (room: any) => void;
    disabled?: boolean;
    status?: string;
    error?: boolean;
}

const fetchRooms = async ({ pageParam = 1, search = '', buildingId = '', status = '' }) => {
    if (!buildingId) return { data: [], meta: { page: 1, totalPages: 0 } };

    let url = `/rooms?buildingId=${buildingId}&page=${pageParam}&limit=10&search=${search}`;
    if (status) {
        url += `&status=${status}`;
    }
    const response = await apiClient.get(url);
    return response.data;
};

export default function RoomSelector({ buildingId, value, onSelect, disabled, status, error }: RoomSelectorProps) {
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
        queryKey: ['rooms', buildingId, debouncedSearch, status],
        queryFn: ({ pageParam }) => fetchRooms({ pageParam, search: debouncedSearch, buildingId, status }),
        getNextPageParam: (lastPage: any) => {
            if (lastPage?.meta) {
                return lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: !!buildingId,
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

    const rooms = data?.pages.flatMap((page: any) => page.data || []) || [];

    // Separate query for current room to ensure name is always visible
    const { data: selectedRoomData } = useQuery({
        queryKey: ['room', value],
        queryFn: async () => {
            if (!value) return null;
            const response = await apiClient.get(`/rooms/${value}`);
            return response.data;
        },
        enabled: !!value,
        staleTime: 1000 * 60 * 5,
    });

    const selectedRoom = rooms.find((r: any) => r._id === value) || selectedRoomData;

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
                        "h-10 w-full justify-between font-normal px-3 flex transition-all duration-200 bg-card border-border rounded-lg",
                        error && "border-destructive focus-visible:ring-destructive",
                        !value && "text-muted-foreground"
                    )}
                    disabled={disabled || !buildingId || (isLoading && !rooms.length)}
                >
                    <div className="flex items-center gap-2 truncate">
                        {value ? (
                            selectedRoom?.roomName ? (
                                <span className="truncate font-medium">{selectedRoom.roomName}</span>
                            ) : (
                                <Skeleton className="h-4 w-24" />
                            )
                        ) : (
                            <span className="truncate text-muted-foreground">
                                {buildingId ? t('rooms.select') : t('rooms.selectBuildingFirst', 'Chọn tòa nhà trước')}
                            </span>
                        )}
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-lg">
                <Command shouldFilter={false} className="max-h-[300px]">
                    <CommandInput
                        placeholder={t('common.search')}
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                    />
                    <CommandList className="scrollbar-thin">
                        {(isLoading && rooms.length === 0) ? (
                            <div className="p-4 space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-[70%]" />
                            </div>
                        ) : rooms.length === 0 && !isLoading ? (
                            <CommandEmpty className="py-6 text-center text-muted-foreground text-sm">
                                {t('common.noData')}
                            </CommandEmpty>
                        ) : null}
                        <CommandGroup>
                            {rooms.map((room: any) => (
                                <CommandItem
                                    key={room._id}
                                    value={room._id}
                                    onSelect={() => {
                                        onSelect(room);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === room._id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {room.roomName}
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
