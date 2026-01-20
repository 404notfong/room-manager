import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ColumnConfig {
    id: string;
    label: string;
    defaultVisible?: boolean;
}

interface ColumnVisibilityState {
    // Map of tableId -> Map of columnId -> visibility
    visibility: Record<string, Record<string, boolean>>;

    // Get visible columns for a table
    isColumnVisible: (tableId: string, columnId: string) => boolean;

    // Toggle a specific column
    toggleColumn: (tableId: string, columnId: string) => void;

    // Set visibility for a column
    setColumnVisibility: (tableId: string, columnId: string, visible: boolean) => void;

    // Initialize columns for a table with defaults
    initializeTable: (tableId: string, columns: ColumnConfig[]) => void;

    // Reset to default visibility
    resetTable: (tableId: string, columns: ColumnConfig[]) => void;

    // Show all columns
    showAllColumns: (tableId: string, columns: ColumnConfig[]) => void;

    // Hide all columns (except required ones)
    hideAllColumns: (tableId: string) => void;
}

export const useColumnVisibilityStore = create<ColumnVisibilityState>()(
    persist(
        (set, get) => ({
            visibility: {},

            isColumnVisible: (tableId: string, columnId: string) => {
                const tableVisibility = get().visibility[tableId];
                if (!tableVisibility) return true; // Default to visible
                return tableVisibility[columnId] !== false;
            },

            toggleColumn: (tableId: string, columnId: string) => {
                set((state) => {
                    const tableVisibility = state.visibility[tableId] || {};
                    const currentValue = tableVisibility[columnId] !== false;
                    return {
                        visibility: {
                            ...state.visibility,
                            [tableId]: {
                                ...tableVisibility,
                                [columnId]: !currentValue,
                            },
                        },
                    };
                });
            },

            setColumnVisibility: (tableId: string, columnId: string, visible: boolean) => {
                set((state) => ({
                    visibility: {
                        ...state.visibility,
                        [tableId]: {
                            ...state.visibility[tableId],
                            [columnId]: visible,
                        },
                    },
                }));
            },

            initializeTable: (tableId: string, columns: ColumnConfig[]) => {
                const state = get();
                if (state.visibility[tableId]) return; // Already initialized

                const defaultVisibility: Record<string, boolean> = {};
                columns.forEach((col) => {
                    defaultVisibility[col.id] = col.defaultVisible !== false;
                });

                set((state) => ({
                    visibility: {
                        ...state.visibility,
                        [tableId]: defaultVisibility,
                    },
                }));
            },

            resetTable: (tableId: string, columns: ColumnConfig[]) => {
                const defaultVisibility: Record<string, boolean> = {};
                columns.forEach((col) => {
                    defaultVisibility[col.id] = col.defaultVisible !== false;
                });

                set((state) => ({
                    visibility: {
                        ...state.visibility,
                        [tableId]: defaultVisibility,
                    },
                }));
            },

            showAllColumns: (tableId: string, columns: ColumnConfig[]) => {
                const allVisible: Record<string, boolean> = {};
                columns.forEach((col) => {
                    allVisible[col.id] = true;
                });

                set((state) => ({
                    visibility: {
                        ...state.visibility,
                        [tableId]: allVisible,
                    },
                }));
            },

            hideAllColumns: (tableId: string) => {
                set((state) => {
                    const tableVisibility = state.visibility[tableId] || {};
                    const allHidden: Record<string, boolean> = {};
                    Object.keys(tableVisibility).forEach((colId) => {
                        allHidden[colId] = false;
                    });
                    return {
                        visibility: {
                            ...state.visibility,
                            [tableId]: allHidden,
                        },
                    };
                });
            },
        }),
        {
            name: 'column-visibility-storage',
        }
    )
);

// Custom hook for easier usage
export function useColumnVisibility(tableId: string, columns: ColumnConfig[]) {
    const store = useColumnVisibilityStore();

    // Initialize on first use
    if (!store.visibility[tableId]) {
        store.initializeTable(tableId, columns);
    }

    return {
        isVisible: (columnId: string) => store.isColumnVisible(tableId, columnId),
        toggle: (columnId: string) => store.toggleColumn(tableId, columnId),
        reset: () => store.resetTable(tableId, columns),
        showAll: () => store.showAllColumns(tableId, columns),
        hideAll: () => store.hideAllColumns(tableId),
        columns,
    };
}
