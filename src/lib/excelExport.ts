// Shared Excel export primitives used by the multi-sheet exporter.
import * as XLSX from "xlsx";

/** Raw numbers with a Taka display format (never currency strings). */
export const BDT_FMT = '"৳"#,##0;("৳"#,##0);"-"';

export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, fileName, { bookType: "xlsx", compression: true, cellStyles: true });
}
