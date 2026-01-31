import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
    count?: number;
    className?: string;
}

export function CardSkeleton({ count = 1, className }: CardSkeletonProps) {
    return (
        <div className={className}>
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="w-full">
                    <CardHeader className="gap-2">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
