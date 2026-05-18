import { useSearchParams } from 'react-router-dom';

interface UseListSearchParamsOptions {
    defaultPage?: number;
    defaultPageSize?: number;
    defaultSortBy?: string;
    defaultSortOrder?: 'asc' | 'desc';
    searchKey?: string;
    pageKey?: string;
    pageSizeKey?: string;
    sortByKey?: string;
    sortOrderKey?: string;
}

const parsePositiveInt = (value: string | null, fallback: number) => {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function useListSearchParams({
    defaultPage = 1,
    defaultPageSize = 10,
    defaultSortBy,
    defaultSortOrder = 'desc',
    searchKey = 'q',
    pageKey = 'page',
    pageSizeKey = 'pageSize',
    sortByKey = 'sortBy',
    sortOrderKey = 'sortOrder',
}: UseListSearchParamsOptions = {}) {
    const [searchParams, setSearchParams] = useSearchParams();

    const searchTerm = searchParams.get(searchKey) ?? '';
    const currentPage = parsePositiveInt(searchParams.get(pageKey), defaultPage);
    const pageSize = parsePositiveInt(searchParams.get(pageSizeKey), defaultPageSize);
    const hasExplicitSort = searchParams.has(sortByKey) || searchParams.has(sortOrderKey);
    const sortBy = searchParams.get(sortByKey) ?? defaultSortBy ?? '';
    const rawSortOrder = searchParams.get(sortOrderKey);
    const sortOrder = rawSortOrder === 'asc' || rawSortOrder === 'desc'
        ? rawSortOrder
        : defaultSortOrder;

    const updateParams = (updates: Record<string, string | number | null | undefined>) => {
        const next = new URLSearchParams(searchParams);

        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                next.delete(key);
            } else {
                next.set(key, String(value));
            }
        });

        setSearchParams(next, { replace: true });
    };

    const setSearchTerm = (value: string) => {
        updateParams({
            [searchKey]: value || null,
            [pageKey]: defaultPage <= 1 ? null : defaultPage,
        });
    };

    const setCurrentPage = (value: number) => {
        updateParams({
            [pageKey]: value <= defaultPage ? null : value,
        });
    };

    const setPageSize = (value: number) => {
        updateParams({
            [pageSizeKey]: value === defaultPageSize ? null : value,
            [pageKey]: defaultPage <= 1 ? null : defaultPage,
        });
    };

    const setSort = (field?: string | null, order?: 'asc' | 'desc' | null) => {
        const nextField = field || null;
        const nextOrder = order || defaultSortOrder;
        const shouldClear =
            !nextField ||
            (defaultSortBy !== undefined &&
                nextField === defaultSortBy &&
                nextOrder === defaultSortOrder);

        updateParams({
            [sortByKey]: shouldClear ? null : nextField,
            [sortOrderKey]: shouldClear ? null : nextOrder,
            [pageKey]: defaultPage <= 1 ? null : defaultPage,
        });
    };

    const clearSort = () => {
        setSort(null, null);
    };

    const toggleSort = (field: string, firstDirection: 'asc' | 'desc' = 'asc') => {
        if (sortBy !== field) {
            setSort(field, firstDirection);
            return;
        }

        if (!hasExplicitSort && defaultSortBy === field && sortOrder === defaultSortOrder) {
            setSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
            return;
        }

        if (sortOrder === 'asc') {
            setSort(field, 'desc');
            return;
        }

        setSort(null, null);
    };

    const getAriaSort = (field: string): 'ascending' | 'descending' | 'none' =>
        sortBy === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';

    return {
        searchParams,
        pageKey,
        searchTerm,
        currentPage,
        pageSize,
        sortBy,
        sortOrder,
        updateParams,
        setSearchTerm,
        setCurrentPage,
        setPageSize,
        setSort,
        toggleSort,
        getAriaSort,
        hasExplicitSort,
        clearSort,
    };
}
