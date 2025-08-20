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
});