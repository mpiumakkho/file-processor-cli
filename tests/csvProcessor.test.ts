import * as fs from 'fs';
import * as path from 'path';
import { CSVProcessor } from '../src/processors/csvProcessor';

describe('CSVProcessor', () => {
  let processor: CSVProcessor;

  beforeEach(() => {
    processor = new CSVProcessor();
  });

  describe('Constructor', () => {
    test('should create processor with default options', () => {
      expect(processor.getOptions()).toEqual({
        delimiter: ',',
        headers: true,
        skipEmptyLines: true,
        encoding: 'utf8'
      });
    });
  });

  describe('processFile', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const testCsvFile = path.join(testDataDir, 'test.csv');
    const emptyCsvFile = path.join(testDataDir, 'empty.csv');

    beforeAll(() => {
      // create test data directory
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // create test CSV file
      const testCsvContent = `name,age,city,country
John Doe,30,New York,USA
Jane Smith,25,London,UK
Bob Johnson,35,Toronto,Canada
Alice Brown,28,Sydney,Australia`;
      fs.writeFileSync(testCsvFile, testCsvContent);

      // create empty CSV file
      fs.writeFileSync(emptyCsvFile, '');
    });

    afterAll(() => {
      // clean up test files
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should process a valid CSV file', async () => {
      const result = await processor.processFile(testCsvFile);
      
      expect(result).toBeDefined();
      expect(result.rowCount).toBe(4);
      expect(result.headers).toEqual(['name', 'age', 'city', 'country']);
      expect(result.fileName).toContain('test.csv');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.data).toHaveLength(4);
      expect(result.data[0]).toEqual({
        name: 'John Doe',
        age: '30',
        city: 'New York',
        country: 'USA'
      });
    });

    it('should throw error for non-existent file', async () => {
      await expect(processor.processFile('nonexistent.csv')).rejects.toThrow('File not found');
    });

    it('should throw error for empty file', async () => {
      await expect(processor.processFile(emptyCsvFile)).rejects.toThrow('File is empty');
    });
  });

  describe('processString', () => {
    // test processing csv data from string input (for API responses)
    it('should process CSV string', async () => {
      const csvString = `name,age\nJohn,30\nJane,25`;
      const result = await processor.processString(csvString);
      
      expect(result.rowCount).toBe(2);
      expect(result.headers).toEqual(['name', 'age']);
      expect(result.data).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' }
      ]);
    });

    // test error handling for empty or whitespace-only string
    it('should throw error for empty string', async () => {
      await expect(processor.processString('')).rejects.toThrow('CSV string is empty');
      await expect(processor.processString('   ')).rejects.toThrow('CSV string is empty');
    });

    // test processing csv string with custom delimiter (semicolon instead of comma)
    it('should process CSV string with custom delimiter', async () => {
      processor.setOptions({ delimiter: ';' });
      const csvString = `name;age\nJohn;30\nJane;25`;
      const result = await processor.processString(csvString);
      
      expect(result.rowCount).toBe(2);
      expect(result.data[0]).toEqual({ name: 'John', age: '30' });
    });
  });

  describe('validateCSV', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const testCsvFile = path.join(testDataDir, 'test.csv');
    const emptyCsvFile = path.join(testDataDir, 'empty.csv');
    const invalidCsvFile = path.join(testDataDir, 'invalid.csv');

    beforeAll(() => {
      // create test data directory
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // create test CSV file
      const testCsvContent = `name,age,city,country
John Doe,30,New York,USA
Jane Smith,25,London,UK`;
      fs.writeFileSync(testCsvFile, testCsvContent);

      // create empty CSV file
      fs.writeFileSync(emptyCsvFile, '');

      // create invalid CSV file with inconsistent columns
      const invalidCsvContent = `name,age,city
John Doe,30,New York,USA,Extra
Jane Smith,25
Bob Johnson,35,Toronto,Canada`;
      fs.writeFileSync(invalidCsvFile, invalidCsvContent);
    });

    afterAll(() => {
      // clean up test files
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    // test validate correct CSV file
    it('should validate a correct CSV file', () => {
      const validation = processor.validateCSV(testCsvFile);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    // test detect non-existent file
    it('should detect non-existent file', () => {
      const validation = processor.validateCSV('nonexistent.csv');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('File not found: nonexistent.csv');
    });

    // test detect empty file
    it('should detect empty file', () => {
      const validation = processor.validateCSV(emptyCsvFile);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('File is empty');
    });

    // test detect inconsistent column count
    it('should detect inconsistent column counts', () => {
      const validation = processor.validateCSV(invalidCsvFile);
      
      expect(validation.warnings.some(warning => warning.includes('inconsistent column counts'))).toBe(true);
    });

    // test warn about non-csv extension
    it('should warn about non-csv extension', () => {
      const txtFile = path.join(testDataDir, 'test.txt');
      fs.writeFileSync(txtFile, 'name,age\nJohn,30');
      
      const validation = processor.validateCSV(txtFile);
      expect(validation.warnings).toContain("File extension is 'txt', expected 'csv'");
      
      fs.unlinkSync(txtFile);
    });
  });

  describe('convertToJSON', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const testCsvFile = path.join(testDataDir, 'test.csv');

    beforeAll(() => {
      // create test data directory
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // create test csv file
      const testCsvContent = `name,age,city,country
John Doe,30,New York,USA
Jane Smith,25,London,UK
Bob Johnson,35,Toronto,Canada
Alice Brown,28,Sydney,Australia`;
      fs.writeFileSync(testCsvFile, testCsvContent);
    });

    afterAll(() => {
      // clean up test files
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    // test convert CSV file to JSON string format
    it('should convert CSV to JSON string', async () => {
      const jsonString = await processor.convertToJSON(testCsvFile);
      const jsonData = JSON.parse(jsonString);
      
      expect(Array.isArray(jsonData)).toBe(true);
      expect(jsonData).toHaveLength(4);
      expect(jsonData[0]).toEqual({
        name: 'John Doe',
        age: '30',
        city: 'New York',
        country: 'USA'
      });
    });

    // test convert CSV file to JSON file output
    it('should convert CSV to JSON file', async () => {
      const outputPath = path.join(testDataDir, 'output.json');
      const result = await processor.convertToJSON(testCsvFile, outputPath);
      
      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const jsonContent = fs.readFileSync(outputPath, 'utf8');
      const jsonData = JSON.parse(jsonContent);
      expect(jsonData).toHaveLength(4);
      
      fs.unlinkSync(outputPath);
    });
  });

  describe('getPreview', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const testCsvFile = path.join(testDataDir, 'test.csv');
    const largeCsvFile = path.join(testDataDir, 'large.csv');

    beforeAll(() => {
      // create test data directory
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // create test CSV file
      const testCsvContent = `name,age,city,country
John Doe,30,New York,USA
Jane Smith,25,London,UK
Bob Johnson,35,Toronto,Canada
Alice Brown,28,Sydney,Australia`;
      fs.writeFileSync(testCsvFile, testCsvContent);

      // create large CSV file for preview testing
      let largeCsvContent = 'id,name,value,description\n';
      for (let i = 1; i <= 10; i++) {
        largeCsvContent += `${i},Item ${i},${i * 10},Description for item ${i}\n`;
      }
      fs.writeFileSync(largeCsvFile, largeCsvContent);
    });

    afterAll(() => {
      // clean up test files
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    // test default preview (5 rows) from large file
    it('should get default preview (5 rows)', async () => {
      const preview = await processor.getPreview(largeCsvFile);
      
      expect(preview.rowCount).toBe(5);
      expect(preview.data).toHaveLength(5);
      expect(preview.headers).toEqual(['id', 'name', 'value', 'description']);
    });

    // test custom preview (3 rows)
    it('should get custom preview (3 rows)', async () => {
      const preview = await processor.getPreview(testCsvFile, 3);
      
      expect(preview.rowCount).toBe(3);
      expect(preview.data).toHaveLength(3);
    });

    // test handle preview larger than actual file size
    it('should handle preview larger than file', async () => {
      const preview = await processor.getPreview(testCsvFile, 10);
      
      expect(preview.rowCount).toBe(4); // file has 4 row
      expect(preview.data).toHaveLength(4);
    });
  });

  describe('getStatistics', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const testCsvFile = path.join(testDataDir, 'test.csv');
    const largeCsvFile = path.join(testDataDir, 'large.csv');

    beforeAll(() => {
      // create test data directory
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // create test CSV file
      const testCsvContent = `name,age,city,country
John Doe,30,New York,USA
Jane Smith,25,London,UK
Bob Johnson,35,Toronto,Canada
Alice Brown,28,Sydney,Australia`;
      fs.writeFileSync(testCsvFile, testCsvContent);

      // create large CSV file for statistics testing
      let largeCsvContent = 'id,name,value,description\n';
      for (let i = 1; i <= 100; i++) {
        largeCsvContent += `${i},Item ${i},${i * 10},Description for item ${i}\n`;
      }
      fs.writeFileSync(largeCsvFile, largeCsvContent);
    });

    afterAll(() => {
      // clean up test files
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    // test get file statistics from normal csv file
    it('should get file statistics', async () => {
      const stats = await processor.getStatistics(testCsvFile);
      
      expect(stats.totalRows).toBe(4);
      expect(stats.totalColumns).toBe(4);
      expect(stats.headers).toEqual(['name', 'age', 'city', 'country']);
      expect(stats.fileSize).toBeGreaterThan(0);
      expect(stats.encoding).toBe('utf8');
    });

    // test get statistic for large csv file
    it('should get statistics for large file', async () => {
      const stats = await processor.getStatistics(largeCsvFile);
      
      expect(stats.totalRows).toBe(100);
      expect(stats.totalColumns).toBe(4);
      expect(stats.fileSize).toBeGreaterThan(1000);
    });
  });
});