import * as fs from 'fs';
import * as path from 'path';
import CSVProcessor from '../src/processors/csvProcessor';
import ExcelProcessor from '../src/processors/excelProcessor';
import XmlProcessor from '../src/processors/xmlProcessor';
import FileValidator from '../src/utils/fileValidator';

describe('Performance Benchmark Tests', () => {
  const testDataDir = path.join(__dirname, 'performance-test-data');
  const outputDir = path.join(testDataDir, 'output');

  beforeAll(() => {
    // Create test directories
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Clean up test files with retry mechanism
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (fs.existsSync(testDataDir)) {
          // Wait a bit to ensure file handles are closed
          await new Promise(resolve => setTimeout(resolve, 500));
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          console.warn(`Failed to clean up performance test directory:`, error);
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  });

  describe('CSV Performance Benchmarks', () => {
    const createLargeCSV = (rows: number): string => {
      const filePath = path.join(testDataDir, `large-${rows}.csv`);
      const header = 'id,name,email,age,city,country,salary,department,active,created_at\n';
      
      let content = header;
      for (let i = 1; i <= rows; i++) {
        content += `${i},User${i},user${i}@example.com,${20 + (i % 50)},City${i % 100},Country${i % 20},${40000 + (i % 60000)},Dept${i % 10},${i % 2 === 0},2023-01-${String(i % 28 + 1).padStart(2, '0')}\n`;
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      return filePath;
    };

    it('should process 1K rows CSV within performance threshold', async () => {
      const csvFile = createLargeCSV(1000);
      const processor = new CSVProcessor();
      
      console.log('\n📊 CSV 1K Performance Test');
      
      // Test file validation
      const validationStart = Date.now();
      const validation = processor.validateCSV(csvFile);
      const validationTime = Date.now() - validationStart;
      console.log(`  Validation: ${validationTime}ms`);
      expect(validation.isValid).toBe(true);
      expect(validationTime).toBeLessThan(100); // Should validate in <100ms
      
      // Test statistics
      const statsStart = Date.now();
      const stats = await processor.getStatistics(csvFile);
      const statsTime = Date.now() - statsStart;
      console.log(`  Statistics: ${statsTime}ms`);
      expect(stats.totalRows).toBe(1000);
      expect(statsTime).toBeLessThan(200); // Should get stats in <200ms
      
      // Test full processing
      const processStart = Date.now();
      const result = await processor.processFile(csvFile);
      const processTime = Date.now() - processStart;
      console.log(`  Processing: ${processTime}ms`);
      console.log(`  Throughput: ${Math.round(1000 / (processTime / 1000))} rows/sec`);
      
      expect(result.rowCount).toBe(1000);
      expect(processTime).toBeLessThan(500); // Should process in <500ms
      
      // Test conversion
      const outputFile = path.join(outputDir, 'perf-1k.json');
      const convertStart = Date.now();
      await processor.convertToJSON(csvFile, outputFile);
      const convertTime = Date.now() - convertStart;
      console.log(`  Conversion: ${convertTime}ms`);
      
      expect(fs.existsSync(outputFile)).toBe(true);
      expect(convertTime).toBeLessThan(1000); // Should convert in <1s
      
      fs.unlinkSync(csvFile);
    }, 30000);

    it('should process 10K rows CSV with acceptable performance', async () => {
      const csvFile = createLargeCSV(10000);
      const processor = new CSVProcessor();
      
      console.log('\n📊 CSV 10K Performance Test');
      
      const processStart = Date.now();
      const result = await processor.processFile(csvFile);
      const processTime = Date.now() - processStart;
      
      console.log(`  Processing: ${processTime}ms`);
      console.log(`  Throughput: ${Math.round(10000 / (processTime / 1000))} rows/sec`);
      console.log(`  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      
      expect(result.rowCount).toBe(10000);
      expect(processTime).toBeLessThan(2000); // Should process in <2s
      
      fs.unlinkSync(csvFile);
    }, 30000);
  });

  describe('Excel Performance Benchmarks', () => {
    const createLargeExcel = (rows: number): string => {
      const XLSX = require('xlsx');
      const filePath = path.join(testDataDir, `large-${rows}.xlsx`);
      
      const workbook = XLSX.utils.book_new();
      
      // Create data
      const data = [['ID', 'Name', 'Email', 'Department', 'Salary']];
      for (let i = 1; i <= rows; i++) {
        data.push([
          i.toString(),
          `Employee ${i}`,
          `emp${i}@company.com`,
          `Dept ${i % 5}`,
          (40000 + (i * 100)).toString()
        ]);
      }
      
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
      XLSX.writeFile(workbook, filePath);
      
      return filePath;
    };

    it('should process Excel file with 1K rows efficiently', async () => {
      const excelFile = createLargeExcel(1000);
      const processor = new ExcelProcessor();
      
      console.log('\n📊 Excel 1K Performance Test');
      
      // Test validation
      const validationStart = Date.now();
      const validation = processor.validateExcel(excelFile);
      const validationTime = Date.now() - validationStart;
      console.log(`  Validation: ${validationTime}ms`);
      expect(validation.isValid).toBe(true);
      
      // Test statistics
      const statsStart = Date.now();
      const stats = await processor.getStatistics(excelFile);
      const statsTime = Date.now() - statsStart;
      console.log(`  Statistics: ${statsTime}ms`);
      expect(stats.totalRows).toBe(1001); // Including header
      
      // Test processing
      const processStart = Date.now();
      const result = await processor.processFile(excelFile);
      const processTime = Date.now() - processStart;
      console.log(`  Processing: ${processTime}ms`);
      console.log(`  Throughput: ${Math.round(1000 / (processTime / 1000))} rows/sec`);
      
      expect(result.data.length).toBe(1000); // Excluding header
      expect(processTime).toBeLessThan(1000); // Should process in <1s
      
      fs.unlinkSync(excelFile);
    }, 30000);
  });

  describe('XML Performance Benchmarks', () => {
    const createLargeXML = (elements: number): string => {
      const filePath = path.join(testDataDir, `large-${elements}.xml`);
      
      let content = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
      
      for (let i = 1; i <= elements; i++) {
        content += `  <item id="${i}" type="record">\n`;
        content += `    <name>Item ${i}</name>\n`;
        content += `    <value>${i * 100}</value>\n`;
        content += `    <category>Category ${i % 10}</category>\n`;
        content += `    <active>${i % 2 === 0 ? 'true' : 'false'}</active>\n`;
        content += `  </item>\n`;
      }
      
      content += '</data>';
      fs.writeFileSync(filePath, content, 'utf8');
      return filePath;
    };

    it('should process XML with 1K elements efficiently', async () => {
      const xmlFile = createLargeXML(1000);
      const processor = new XmlProcessor();
      
      console.log('\n📊 XML 1K Elements Performance Test');
      
      // Test validation
      const validationStart = Date.now();
      const validation = processor.validateXml(xmlFile);
      const validationTime = Date.now() - validationStart;
      console.log(`  Validation: ${validationTime}ms`);
      expect(validation.isValid).toBe(true);
      
      // Test statistics
      const statsStart = Date.now();
      const stats = await processor.getStatistics(xmlFile);
      const statsTime = Date.now() - statsStart;
      console.log(`  Statistics: ${statsTime}ms`);
      expect(stats.totalElements).toBeGreaterThan(1000);
      
      // Test processing
      const processStart = Date.now();
      const result = await processor.processFile(xmlFile);
      const processTime = Date.now() - processStart;
      console.log(`  Processing: ${processTime}ms`);
      console.log(`  Elements: ${stats.totalElements}, Max Depth: ${stats.maxDepth}`);
      
      expect(result.structure.totalElements).toBeGreaterThan(1000);
      expect(processTime).toBeLessThan(2000); // Should process in <2s
      
      fs.unlinkSync(xmlFile);
    }, 30000);
  });

  describe('File Detection Performance', () => {
    it('should detect file types quickly', async () => {
      // Create test files
      const csvFile = path.join(testDataDir, 'detect-test.csv');
      const excelFile = path.join(testDataDir, 'detect-test.xlsx');
      const xmlFile = path.join(testDataDir, 'detect-test.xml');
      
      fs.writeFileSync(csvFile, 'name,age\nJohn,30\nJane,25', 'utf8');
      fs.writeFileSync(xmlFile, '<?xml version="1.0"?><root><item>test</item></root>', 'utf8');
      
      // Create minimal Excel file
      const XLSX = require('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([['Name', 'Age'], ['John', 30]]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, excelFile);
      
      console.log('\n📊 File Detection Performance Test');
      
      // Test CSV detection
      const csvStart = Date.now();
      const csvResult = FileValidator.detectFileType(csvFile);
      const csvTime = Date.now() - csvStart;
      console.log(`  CSV Detection: ${csvTime}ms (${csvResult.confidence * 100}% confidence)`);
      expect(csvResult.detectedType).toBe('csv');
      expect(csvTime).toBeLessThan(50); // Should detect in <50ms
      
      // Test Excel detection
      const excelStart = Date.now();
      const excelResult = FileValidator.detectFileType(excelFile);
      const excelTime = Date.now() - excelStart;
      console.log(`  Excel Detection: ${excelTime}ms (${excelResult.confidence * 100}% confidence)`);
      expect(excelResult.detectedType).toBe('excel');
      expect(excelTime).toBeLessThan(100); // Should detect in <100ms
      
      // Test XML detection
      const xmlStart = Date.now();
      const xmlResult = FileValidator.detectFileType(xmlFile);
      const xmlTime = Date.now() - xmlStart;
      console.log(`  XML Detection: ${xmlTime}ms (${xmlResult.confidence * 100}% confidence)`);
      expect(xmlResult.detectedType).toBe('xml');
      expect(xmlTime).toBeLessThan(50); // Should detect in <50ms
      
      // Clean up
      fs.unlinkSync(csvFile);
      fs.unlinkSync(excelFile);
      fs.unlinkSync(xmlFile);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should not leak memory during processing', async () => {
      const csvFile = path.join(testDataDir, 'memory-test.csv');
      
      // Create medium-sized CSV
      let content = 'id,name,email,data\n';
      for (let i = 1; i <= 5000; i++) {
        content += `${i},User${i},user${i}@test.com,${Array(100).fill('x').join('')}\n`;
      }
      fs.writeFileSync(csvFile, content, 'utf8');
      
      console.log('\n📊 Memory Usage Test');
      
      const processor = new CSVProcessor();
      const initialMemory = process.memoryUsage().heapUsed;
      console.log(`  Initial Memory: ${Math.round(initialMemory / 1024 / 1024)}MB`);
      
      // Process file multiple times
      for (let i = 0; i < 5; i++) {
        await processor.processFile(csvFile);
        const currentMemory = process.memoryUsage().heapUsed;
        console.log(`  After run ${i + 1}: ${Math.round(currentMemory / 1024 / 1024)}MB`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      console.log(`  Final Memory: ${Math.round(finalMemory / 1024 / 1024)}MB`);
      console.log(`  Memory Growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
      
      // Memory growth should be reasonable (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      
      fs.unlinkSync(csvFile);
    }, 60000);
  });

  describe('Concurrent Processing', () => {
    it('should handle concurrent file processing', async () => {
      const files: string[] = [];
      
      // Create multiple test files
      for (let i = 1; i <= 3; i++) {
        const filePath = path.join(testDataDir, `concurrent-${i}.csv`);
        let content = 'id,name,value\n';
        for (let j = 1; j <= 100; j++) {
          content += `${j},Item${j},${j * i}\n`;
        }
        fs.writeFileSync(filePath, content, 'utf8');
        files.push(filePath);
      }
      
      console.log('\n📊 Concurrent Processing Test');
      
      const processor = new CSVProcessor();
      const startTime = Date.now();
      
      // Process all files concurrently
      const promises = files.map(async (file, index) => {
        const result = await processor.processFile(file);
        console.log(`  File ${index + 1}: ${result.processingTime}ms`);
        return result;
      });
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      console.log(`  Total concurrent time: ${totalTime}ms`);
      console.log(`  Average per file: ${Math.round(totalTime / files.length)}ms`);
      
      // All files should be processed successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.rowCount).toBe(100);
      });
      
      // Clean up
      files.forEach(file => fs.unlinkSync(file));
    }, 30000);
  });
});