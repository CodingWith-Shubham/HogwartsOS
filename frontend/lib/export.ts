import * as xlsx from 'xlsx';

export function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }
  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Data');
  xlsx.writeFile(wb, `${filename}.xlsx`);
}
