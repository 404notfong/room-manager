import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ReactNode } from 'react';

interface DraggableRoomCardProps {
    id: string;
    children: ReactNode;
    disabled?: boolean;
}

export function DraggableRoomCard({ id, children, disabled = false }: DraggableRoomCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id,
        disabled,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className="group/drag">
            {/* Drag Handle - shows on hover */}
            {!disabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded opacity-0 group-hover/drag:opacity-100 hover:bg-muted cursor-grab active:cursor-grabbing transition-opacity"
                    title="Kéo để sắp xếp"
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
            )}
            {children}
        </div>
    );
}
