import { ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  className?: string;
  children: ReactNode;
}

/** A TableHead that's also a sort control — complements, not replaces, the
 * existing sort dropdowns on Income/Dues (item 21 of the UI/UX list). */
export function SortableTableHead({ active, direction, onClick, className, children }: SortableTableHeadProps) {
  return (
    <TableHead
      role="columnheader"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("cursor-pointer select-none hover:text-foreground", className)}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
      >
        {children}
        {active ? (
          direction === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}
