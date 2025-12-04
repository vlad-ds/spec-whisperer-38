import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'under_review' | 'reviewed';
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const isReviewed = status === 'reviewed';
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isReviewed
          ? 'bg-success/10 text-success'
          : 'bg-warning/20 text-warning-foreground'
      )}
    >
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        isReviewed ? 'bg-success' : 'bg-warning'
      )} />
      {isReviewed ? 'Reviewed' : 'Under Review'}
    </span>
  );
};
