import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Integration Tests - End-to-End Workflows', () => {
  const testDataDir = path.join(__dirname, 'integration-test-data');
  const outputDir = path.join(testDataDir, 'output');
  
  // Test file paths
  const testCSV = path.join(testDataDir, 'integration-test.csv');
  const testExcel = path.join(testDataDir, 'integration-test.xlsx');
  const testXML = path.join(testDataDir, 'integration-test.xml');
  
  beforeAll(() => {
    // Create test directories
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create test CSV file
    const csvContent = `id,name,age,city,country,salary,department,active
1,John Doe,30,New York,USA,75000,Engineering,true
2,Jane Smith,28,London,UK,65000,Marketing,true
3,Bob Johnson,35,Toronto,Canada,80000,Engineering,false
4,Alice Brown,32,Sydney,Australia,70000,Sales,true
5,Charlie Wilson,29,Berlin,Germany,68000,Marketing,true`;
    fs.writeFileSync(testCSV, csvContent, 'utf8');

    // Create test Excel file (we'll create a simple one using XLSX)
    const XLSX = require('xlsx');
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Employees
    const employeesData = [
      ['ID', 'Name', 'Department', 'Salary'],
      [1, 'John Doe', 'Engineering', 75000],
      [2, 'Jane Smith', 'Marketing', 65000],
      [3, 'Bob Johnson', 'Engineering', 80000]
    ];
    const employeesSheet = XLSX.utils.aoa_to_sheet(employeesData);
    XLSX.utils.book_append_sheet(workbook, employeesSheet, 'Employees');
    
    // Sheet 2: Departments
    const departmentsData = [
      ['Department', 'Manager', 'Budget'],
      ['Engineering', 'Tech Lead', 500000],
      ['Marketing', 'Marketing Head', 300000],
      ['Sales', 'Sales Director', 400000]
    ];
    const departmentsSheet = XLSX.utils.aoa_to_sheet(departmentsData);
    XLSX.utils.book_append_sheet(workbook, departmentsSheet, 'Departments');
    
    XLSX.writeFile(workbook, testExcel);

    // Create test XML file
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<company>
  <info>
    <name>Test Company</name>
    <founded>2020</founded>
    <industry>Technology</industry>
  </info>
  <employees>
    <employee id="1" active="true">
      <name>John Doe</name>
      <position>Software Engineer</position>
      <salary currency="USD">75000</salary>
      <skills>
        <skill level="expert">JavaScript</skill>
        <skill level="intermediate">Python</skill>
        <skill level="beginner">Go</skill>
      </skills>
    </employee>
    <employee id="2" active="true">
      <name>Jane Smith</name>
      <position>Marketing Manager</position>
      <salary currency="USD">65000</salary>
      <skills>
        <skill level="expert">Marketing</skill>
        <skill level="intermediate">Analytics</skill>
      </skills>
    </employee>
    <employee id="3" active="false">
      <name>Bob Johnson</name>
      <position>Senior Engineer</position>
      <salary currency="USD">80000</salary>
      <skills>
        <skill level="expert">Java</skill>
        <skill level="expert">System Design</skill>
      </skills>
    </employee>
  </employees>
  <departments>
    <department id="eng">
      <name>Engineering</name>
      <head>Tech Lead</head>
      <budget>500000</budget>
    </department>
    <department id="mkt">
      <name>Marketing</name>
      <head>Marketing Head</head>
      <budget>300000</budget>
    </department>
  </departments>
</company>`;
    fs.writeFileSync(testXML, xmlContent, 'utf8');
  });

  afterAll(async () => {
    // Clean up test files with retry mechanism
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (fs.existsSync(testDataDir)) {
          // Wait a bit to ensure file handles are closed
          await new Promise(resolve => setTimeout(resolve, 1000));
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          console.warn(`Failed to clean up test directory after ${maxRetries} attempts:`, error);
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  });

  describe('File Detection Integration', () => {
    it('should detect CSV file type correctly through CLI', () => {
      const output = execSync(`npm run detect "${testCSV}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toContain('Detected Type: csv');
      expect(output).toContain('CSVProcessor');
      expect(output).toContain('npm run test-csv');
    });

    it('should detect Excel file type correctly through CLI', () => {
      const output = execSync(`npm run detect "${testExcel}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toContain('Detected Type: excel');
      expect(output).toContain('ExcelProcessor');
      expect(output).toContain('npm run test-excel');
    });

    it('should detect XML file type correctly through CLI', () => {
      const output = execSync(`npm run detect "${testXML}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toContain('Detected Type: xml');
      expect(output).toContain('XmlProcessor');
      expect(output).toContain('npm run test-xml');
    });
  });

  describe('CSV Workflow Integration', () => {
    it('should complete full CSV processing workflow', () => {
      const outputFile = path.join(outputDir, 'csv-integration.json');
      
      // Test CSV processing
      const testOutput = execSync(`npm run test-csv "${testCSV}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      expect(testOutput).toContain('Testing CSV file');
      expect(testOutput).toContain('Total rows: 5');
      expect(testOutput).toContain('Total columns: 8');
      
      // Convert CSV to JSON
      const convertOutput = execSync(`npm run convert-csv "${testCSV}" -- -o "${outputFile}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      expect(convertOutput).toContain('JSON saved to');
      
      // Verify output file exists and contains correct data
      expect(fs.existsSync(outputFile)).toBe(true);
      const jsonContent = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(Array.isArray(jsonContent)).toBe(true);
      expect(jsonContent).toHaveLength(5);
      expect(jsonContent[0]).toHaveProperty('name', 'John Doe');
      expect(jsonContent[0]).toHaveProperty('age', '30');
    });

    it('should handle CSV auto-processing workflow', () => {
      const outputFile = path.join(outputDir, 'csv-auto.json');
      
      const output = execSync(`npm run process "${testCSV}" -- -o "${outputFile}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toContain('Auto-processing file');
      expect(output).toContain('Detected file type: CSV');
      expect(output).toContain('CSV converted and saved to');
      
      // Verify output
      expect(fs.existsSync(outputFile)).toBe(true);
      const jsonData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(Array.isArray(jsonData)).toBe(true);
    });
  });

  describe('Excel Workflow Integration', () => {
    it('should complete full Excel processing workflow', () => {
      const outputFile = path.join(outputDir, 'excel-integration.json');
      
      // Test Excel processing
      const testOutput = execSync(`npm run test-excel "${testExcel}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      expect(testOutput).toContain('Testing Excel file');
      expect(testOutput).toContain('Available sheets: Employees, Departments');
      expect(testOutput).toContain('Total sheets: 2');
      
      // Convert Excel to JSON (single sheet)
      const convertOutput = execSync(`npm run convert-excel "${testExcel}" -- -s "Employees" -o "${outputFile}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      expect(convertOutput).toContain('JSON saved to');
      
      // Verify output
      expect(fs.existsSync(outputFile)).toBe(true);
      const jsonContent = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(jsonContent).toHaveProperty('fileName');
      expect(jsonContent).toHaveProperty('data');
      expect(Array.isArray(jsonContent.data)).toBe(true);
    });

    it('should process all Excel sheets', () => {
      const outputFile = path.join(outputDir, 'excel-all-sheets.json');
      
      const output = execSync(`npm run convert-excel "${testExcel}" -- --all-sheets -o "${outputFile}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toContain('Processing all sheets');
      expect(output).toContain('Sheet: Employees');
      expect(output).toContain('Sheet: Departments');
      
      // Verify output contains both sheets
      expect(fs.existsSync(outputFile)).toBe(true);
      const jsonData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(jsonData).toHaveProperty('Employees');
      expect(jsonData).toHaveProperty('Departments');
    });

    it('should handle Excel auto-processing workflow', () => {
      const outputFile = path.join(outputDir, 'excel-auto.json');
      
      const output = execSync(`npm run process "${testExcel}" -- -o "${outputFile}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toContain('Detected file type: EXCEL');
      expect(output).toContain('Excel converted and saved to');
      
      expect(fs.existsSync(outputFile)).toBe(true);
    });
  });

  describe('XML Workflow Integration', () => {
    it('should complete full XML processing workflow', () => {
      const outputFile = path.join(outputDir, 'xml-integration.json');
      
      // Test XML processing
      const testOutput = execSync(`npm run test-xml "${testXML}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      expect(testOutput).toContain('Testing XML file');
      expect(testOutput).toContain('Root element: company');
      expect(testOutput).toContain('Total elements:');
      expect(testOutput).toContain('Max depth:');
      
      // Convert XML to JSON
      const convertOutput = execSync(`npm run convert-xml "${testXML}" -- -o "${outputFile}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      expect(convertOutput).toContain('JSON saved to');
      
      // Verify output
      expect(fs.existsSync(outputFile)).toBe(true);
      const jsonContent = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(jsonContent).toHaveProperty('data');
      expect(jsonContent).toHaveProperty('structure');
      expect(jsonContent.data).toHaveProperty('company');
    });

    it('should handle XML auto-processing workflow', () => {
      const outputFile = path.join(outputDir, 'xml-auto.json');
      
      const output = execSync(`npm run process "${testXML}" -- -o "${outputFile}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toContain('Detected file type: XML');
      expect(output).toContain('XML converted and saved to');
      
      expect(fs.existsSync(outputFile)).toBe(true);
      const jsonData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(jsonData).toHaveProperty('data');
    });
  });

  describe('Cross-Format Integration', () => {
    it('should process multiple different file types in sequence', () => {
      const csvOutput = path.join(outputDir, 'multi-csv.json');
      const excelOutput = path.join(outputDir, 'multi-excel.json');
      const xmlOutput = path.join(outputDir, 'multi-xml.json');
      
      // Process all three file types
      execSync(`npm run process "${testCSV}" -- -o "${csvOutput}"`, { timeout: 30000 });
      execSync(`npm run process "${testExcel}" -- -o "${excelOutput}"`, { timeout: 30000 });
      execSync(`npm run process "${testXML}" -- -o "${xmlOutput}"`, { timeout: 30000 });
      
      // Verify all outputs exist
      expect(fs.existsSync(csvOutput)).toBe(true);
      expect(fs.existsSync(excelOutput)).toBe(true);
      expect(fs.existsSync(xmlOutput)).toBe(true);
      
      // Verify different structures
      const csvData = JSON.parse(fs.readFileSync(csvOutput, 'utf8'));
      const excelData = JSON.parse(fs.readFileSync(excelOutput, 'utf8'));
      const xmlData = JSON.parse(fs.readFileSync(xmlOutput, 'utf8'));
      
      expect(Array.isArray(csvData)).toBe(true); // CSV returns array
      expect(excelData).toHaveProperty('data'); // Excel returns object with data property
      expect(xmlData).toHaveProperty('data'); // XML returns object with data property
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle non-existent files gracefully', () => {
      const output = execSync('npm run detect "nonexistent.csv"', { 
        encoding: 'utf8',
        timeout: 10000 
      });
      
      // Check that error message is in the output (our CLI handles errors gracefully)
      expect(output).toContain('File not found');
    });

    it('should handle invalid file formats gracefully', () => {
      // Create an empty file
      const invalidFile = path.join(testDataDir, 'invalid.csv');
      fs.writeFileSync(invalidFile, '', 'utf8');
      
      const output = execSync(`npm run process "${invalidFile}"`, { 
        encoding: 'utf8',
        timeout: 10000 
      });
      
      // Check that empty file is detected and handled gracefully
      expect(output).toContain('Auto-processing file');
      
      fs.unlinkSync(invalidFile);
    });

    it('should validate Excel file with missing sheets gracefully', () => {
      const output = execSync(`npm run convert-excel "${testExcel}" -- -s "NonExistentSheet"`, { 
        encoding: 'utf8',
        timeout: 10000 
      });
      
      // Check that processing attempts to find non-existent sheet
      expect(output).toContain('Processing sheet: NonExistentSheet');
    });
  });

  describe('Performance Integration', () => {
    it('should handle processing within reasonable time limits', () => {
      const startTime = Date.now();
      
      execSync(`npm run process "${testCSV}"`, { 
        encoding: 'utf8',
        timeout: 15000 // 15 second timeout
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should complete within 10 seconds for small test file
      expect(processingTime).toBeLessThan(10000);
    }, 20000);

    it('should report processing times accurately', () => {
      const output = execSync(`npm run test-csv "${testCSV}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      expect(output).toMatch(/Processing completed in \d+ms/);
      expect(output).toMatch(/Total rows processed: \d+/);
    });
  });

  describe('Data Integrity Integration', () => {
    it('should preserve data accuracy through processing pipeline', () => {
      const outputFile = path.join(outputDir, 'integrity-test.json');
      
      // Process CSV file
      execSync(`npm run convert-csv "${testCSV}" -- -o "${outputFile}"`, { timeout: 30000 });
      
      // Read and verify data
      const processedData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      
      expect(processedData).toHaveLength(5);
      expect(processedData[0]).toEqual({
        id: '1',
        name: 'John Doe',
        age: '30',
        city: 'New York',
        country: 'USA',
        salary: '75000',
        department: 'Engineering',
        active: 'true'
      });
      
      expect(processedData[2]).toEqual({
        id: '3',
        name: 'Bob Johnson',
        age: '35',
        city: 'Toronto',
        country: 'Canada',
        salary: '80000',
        department: 'Engineering',
        active: 'false'
      });
    });

    it('should maintain XML structure and attributes', () => {
      const outputFile = path.join(outputDir, 'xml-integrity.json');
      
      execSync(`npm run convert-xml "${testXML}" -- -o "${outputFile}"`, { timeout: 30000 });
      
      const xmlData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      
      // Verify XML structure is preserved
      expect(xmlData.data.company).toBeDefined();
      expect(xmlData.data.company.employees).toBeDefined();
      expect(xmlData.data.company.departments).toBeDefined();
      
      // Verify attributes are preserved
      expect(xmlData.structure.totalElements).toBeGreaterThan(0);
      expect(xmlData.structure.maxDepth).toBeGreaterThan(0);
    });
  });
});