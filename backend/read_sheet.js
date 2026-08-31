import xlsx from 'xlsx';

try {
    const filePath = 'c:\\Users\\mamga\\OneDrive\\Desktop\\HogwartsOS\\Hogwarts_CRM_Migration_Mapped.xlsx';
    const workbook = xlsx.readFile(filePath);
    
    workbook.SheetNames.forEach(sheetName => {
        if (sheetName.startsWith('README')) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            console.log(`\n=== SHEET: ${sheetName} ===`);
            data.forEach(row => {
                if (row.length > 0) console.log(row.join(' | '));
            });
        }
    });
} catch (e) {
    console.error("Error reading file:", e.message);
}
