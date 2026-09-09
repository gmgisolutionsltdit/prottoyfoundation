import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Icon + message (+ optional CTA), for a table with nothing in it yet. */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** Same content, wrapped in a full-width table row/cell so it can drop straight into a <TableBody>. */
export function EmptyStateRow({ colSpan, ...props }: EmptyStateProps & { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <EmptyState {...props} />
      </TableCell>
    </TableRow>
  );
}
