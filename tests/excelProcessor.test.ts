import { ExcelProcessor, ExcelProcessorOptions } from '../src/processors/excelProcessor';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

describe('ExcelProcessor', () => {
  let processor: ExcelProcessor;
  const testDataDir = path.join(__dirname, 'test-data');

  beforeEach(() => {
    processor = new ExcelProcessor();
  });

  describe('Constructor and Options', () => {
    it('should create processor with default options', () => {
      const options = processor.getOptions();
      expect(options.encoding).toBe('binary');
      expect(options.sheetIndex).toBe(0);
      expect(options.header).toBeUndefined(); // Default is to let XLSX auto-detect headers
    });

    it('should create processor with custom options', () => {
      const customOptions: ExcelProcessorOptions = {
        sheetIndex: 1,
        header: ['col1', 'col2', 'col3'],
        range: 'A1:C10'
      };
      const customProcessor = new ExcelProcessor(customOptions);
      const options = customProcessor.getOptions();
      expect(options.sheetIndex).toBe(1);
      expect(options.header).toEqual(['col1', 'col2', 'col3']);
      expect(options.range).toBe('A1:C10');
    });

    it('should update options using setOptions', () => {
      processor.setOptions({ sheetIndex: 2, sheetName: 'Sheet2' });
      const options = processor.getOptions();
      expect(options.sheetIndex).toBe(2);
      expect(options.sheetName).toBe('Sheet2');
      expect(options.encoding).toBe('binary'); // Should preserve existing options
    });
  });

  describe('processFile', () => {
    const testExcelFile = path.join(testDataDir, 'test.xlsx');
    const emptyExcelFile = path.join(testDataDir, 'empty.xlsx');

    beforeAll(() => {
      // Create test data directory
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // Create test Excel file
      const workbook = XLSX.utils.book_new();
      const worksheetData = [
        ['Name', 'Age', 'City', 'Country'],
        ['John Doe', 30, 'New York', 'USA'],
        ['Jane Smith', 25, 'London', 'UK'],
        ['Bob Johnson', 35, 'Toronto', 'Canada']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, testExcelFile);

      // Create empty Excel file (with at least one empty sheet)
      const emptyWorkbook = XLSX.utils.book_new();
      const emptySheet = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.book_append_sheet(emptyWorkbook, emptySheet, 'Empty');
      XLSX.writeFile(emptyWorkbook, emptyExcelFile);
    });

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should process a valid Excel file', async () => {
      const result = await processor.processFile(testExcelFile);
      
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(3); // 3 data rows (excluding header)
      expect(result.fileName).toContain('test.xlsx');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.sheetInfo.name).toBe('Sheet1');
      expect(result.sheetInfo.rowCount).toBe(4);
      expect(result.sheetInfo.columnCount).toBe(4);
    });

    it('should throw error for non-existent file', async () => {
      await expect(processor.processFile('nonexistent.xlsx')).rejects.toThrow('File not found');
    });

    it('should throw error for empty file', async () => {
      const emptyFile = path.join(testDataDir, 'truly-empty.xlsx');
      fs.writeFileSync(emptyFile, '');
      
      await expect(processor.processFile(emptyFile)).rejects.toThrow('File is empty');
      
      fs.unlinkSync(emptyFile);
    });
  });

  describe('processSheet', () => {
    const multiSheetFile = path.join(testDataDir, 'multisheet.xlsx');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // Create multi-sheet Excel file
      const workbook = XLSX.utils.book_new();
      
      // Sheet 1
      const sheet1Data = [['ID', 'Name'], [1, 'John'], [2, 'Jane']];
      const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Data);
      XLSX.utils.book_append_sheet(workbook, sheet1, 'Users');
      
      // Sheet 2
      const sheet2Data = [['Product', 'Price'], ['Laptop', 1000], ['Mouse', 25]];
      const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Data);
      XLSX.utils.book_append_sheet(workbook, sheet2, 'Products');
      
      XLSX.writeFile(workbook, multiSheetFile);
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should process specific sheet by name', async () => {
      const result = await processor.processSheet(multiSheetFile, 'Products');
      
      expect(result.sheetInfo.name).toBe('Products');
      expect(result.data).toHaveLength(2); // 2 data rows (excluding header)
      expect(result.data[0]).toEqual({ Product: 'Laptop', Price: 1000 });
    });

    it('should throw error for non-existent sheet', async () => {
      await expect(processor.processSheet(multiSheetFile, 'NonExistent')).rejects.toThrow('Sheet "NonExistent" not found');
    });
  });

  describe('validateExcel', () => {
    const testExcelFile = path.join(testDataDir, 'test.xlsx');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // Create test Excel file
      const workbook = XLSX.utils.book_new();
      const worksheetData = [['Name', 'Age'], ['John', 30]];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, testExcelFile);
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should validate a correct Excel file', () => {
      const validation = processor.validateExcel(testExcelFile);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.fileInfo?.sheets).toContain('Sheet1');
    });

    it('should detect non-existent file', () => {
      const validation = processor.validateExcel('nonexistent.xlsx');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('File not found: nonexistent.xlsx');
    });

    it('should warn about non-excel extension', () => {
      const txtFile = path.join(testDataDir, 'test.txt');
      fs.writeFileSync(txtFile, 'not an excel file');
      
      const validation = processor.validateExcel(txtFile);
      expect(validation.warnings.some(warning => warning.includes('expected Excel format'))).toBe(true);
      
      fs.unlinkSync(txtFile);
    });
  });

  describe('getSheetNames', () => {
    const multiSheetFile = path.join(testDataDir, 'multisheet.xlsx');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      const workbook = XLSX.utils.book_new();
      const sheet1 = XLSX.utils.aoa_to_sheet([['A'], [1]]);
      const sheet2 = XLSX.utils.aoa_to_sheet([['B'], [2]]);
      XLSX.utils.book_append_sheet(workbook, sheet1, 'First');
      XLSX.utils.book_append_sheet(workbook, sheet2, 'Second');
      XLSX.writeFile(workbook, multiSheetFile);
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should get all sheet names', () => {
      const sheetNames = processor.getSheetNames(multiSheetFile);
      
      expect(sheetNames).toEqual(['First', 'Second']);
    });
  });

  describe('getStatistics', () => {
    const testExcelFile = path.join(testDataDir, 'test.xlsx');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      const workbook = XLSX.utils.book_new();
      const worksheetData = [
        ['Name', 'Age', 'City'],
        ['John', 30, 'NYC'],
        ['Jane', 25, 'LA']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, testExcelFile);
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should get file statistics', async () => {
      const stats = await processor.getStatistics(testExcelFile);
      
      expect(stats.totalSheets).toBe(1);
      expect(stats.totalRows).toBe(3);
      expect(stats.totalCells).toBe(9); // 3 rows × 3 columns
      expect(stats.fileSize).toBeGreaterThan(0);
      expect(stats.sheets).toHaveLength(1);
      expect(stats.sheets[0].name).toBe('Sheet1');
    });
  });
});