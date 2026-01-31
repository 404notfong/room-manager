import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
    showActionColumn?: boolean;
}

export function TableSkeleton({
    rows = 5,
    columns = 5,
    showActionColumn = true
}: TableSkeletonProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: columns }).map((_, i) => (
                        <TableHead key={i}>
                            <Skeleton className="h-4 w-24" />
                        </TableHead>
                    ))}
                    {showActionColumn && <TableHead className="w-[70px]" />}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: rows }).map((_, r) => (
                    <TableRow key={r}>
                        {Array.from({ length: columns }).map((_, c) => (
                            <TableCell key={c}>
                                <Skeleton className="h-4 w-full" />
                            </TableCell>
                        ))}
                        {showActionColumn && (
                            <TableCell>
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
