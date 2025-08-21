import { FileValidator, FileType } from '../src/utils/fileValidator';
import * as fs from 'fs';
import * as path from 'path';

describe('FileValidator', () => {
  const testDataDir = path.join(__dirname, 'validator-test-data');

  beforeAll(() => {
    // Create test data directory
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Create test CSV file
    const csvContent = `name,age,city
John Doe,30,New York
Jane Smith,25,London
Bob Johnson,35,Toronto`;
    fs.writeFileSync(path.join(testDataDir, 'test.csv'), csvContent, 'utf8');

    // Create test TSV file  
    const tsvContent = `name\tage\tcity
John Doe\t30\tNew York
Jane Smith\t25\tLondon`;
    fs.writeFileSync(path.join(testDataDir, 'test.tsv'), tsvContent, 'utf8');

    // Create test XML file
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="1">
    <title>Sample Book</title>
    <author>John Author</author>
  </book>
</catalog>`;
    fs.writeFileSync(path.join(testDataDir, 'test.xml'), xmlContent, 'utf8');

    // Create malformed XML file
    const malformedXml = `<root>
  <item>Test</item>
  <unclosed>
</root>`;
    fs.writeFileSync(path.join(testDataDir, 'malformed.xml'), malformedXml, 'utf8');

    // Create text file that looks like CSV
    const csvLikeText = `data,value,description
item1,100,first item
item2,200,second item`;
    fs.writeFileSync(path.join(testDataDir, 'data.txt'), csvLikeText, 'utf8');

    // Create empty file
    fs.writeFileSync(path.join(testDataDir, 'empty.csv'), '', 'utf8');

    // Create binary file that's not Excel
    const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG signature
    fs.writeFileSync(path.join(testDataDir, 'fake.xlsx'), binaryData);
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('validateFile', () => {
    it('should validate a CSV file correctly', () => {
      const result = FileValidator.validateFile(path.join(testDataDir, 'test.csv'));
      
      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe(FileType.CSV);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo.extension).toBe('.csv');
      expect(result.fileInfo.size).toBeGreaterThan(0);
    });

    it('should validate a TSV file as CSV', () => {
      const result = FileValidator.validateFile(path.join(testDataDir, 'test.tsv'));
      
      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe(FileType.CSV);
      expect(result.fileInfo.extension).toBe('.tsv');
    });

    it('should validate an XML file correctly', () => {
      const result = FileValidator.validateFile(path.join(testDataDir, 'test.xml'));
      
      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe(FileType.XML);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo.extension).toBe('.xml');
    });

    it('should detect CSV-like content in .txt file', () => {
      const result = FileValidator.validateFile(path.join(testDataDir, 'data.txt'));
      
      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe(FileType.CSV);
      expect(result.fileInfo.extension).toBe('.txt');
    });

    it('should reject non-existent file', () => {
      const result = FileValidator.validateFile('nonexistent.csv');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File not found: nonexistent.csv');
    });

    it('should reject empty file', () => {
      const result = FileValidator.validateFile(path.join(testDataDir, 'empty.csv'));
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should handle malformed XML gracefully', () => {
      const result = FileValidator.validateFile(path.join(testDataDir, 'malformed.xml'));
      
      expect(result.isValid).toBe(true); // Still detected as XML based on content
      expect(result.fileType).toBe(FileType.XML);
      // Malformed XML might still have good confidence if extension matches
      expect(result.fileInfo.extension).toBe('.xml');
    });

    it('should detect Excel by extension even if content is different', () => {
      const result = FileValidator.validateFile(path.join(testDataDir, 'fake.xlsx'));
      
      // Will be detected as Excel due to .xlsx extension, even with PNG content
      expect(result.fileType).toBe(FileType.EXCEL);
      expect(result.isValid).toBe(true);
      // But might have warnings about confidence
    });
  });

  describe('detectFileType', () => {
    it('should detect CSV by extension and content', () => {
      const result = FileValidator.detectFileType(path.join(testDataDir, 'test.csv'));
      
      expect(result.detectedType).toBe(FileType.CSV);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasons).toContain('CSV indicators found');
    });

    it('should detect XML by content even without XML extension', () => {
      // Create XML file with .txt extension
      const xmlWithTxtExt = path.join(testDataDir, 'xml-content.txt');
      fs.writeFileSync(xmlWithTxtExt, '<?xml version="1.0"?><root><item>test</item></root>', 'utf8');
      
      const result = FileValidator.detectFileType(xmlWithTxtExt);
      
      expect(result.detectedType).toBe(FileType.XML);
      expect(result.reasons).toContain('File content matches XML format');
      
      fs.unlinkSync(xmlWithTxtExt);
    });

    it('should return low confidence for ambiguous files', () => {
      // Create a file with minimal content
      const ambiguousFile = path.join(testDataDir, 'ambiguous.unknown');
      fs.writeFileSync(ambiguousFile, 'some,data\nother,info', 'utf8');
      
      const result = FileValidator.detectFileType(ambiguousFile);
      
      // Should detect as CSV based on content but with lower confidence due to unknown extension
      expect(result.detectedType).toBe(FileType.CSV);
      expect(result.confidence).toBeLessThan(1);
      
      fs.unlinkSync(ambiguousFile);
    });
  });

  describe('getProcessorForFile', () => {
    it('should return correct processor name for CSV', () => {
      const processor = FileValidator.getProcessorForFile(path.join(testDataDir, 'test.csv'));
      expect(processor).toBe('CSVProcessor');
    });

    it('should return correct processor name for XML', () => {
      const processor = FileValidator.getProcessorForFile(path.join(testDataDir, 'test.xml'));
      expect(processor).toBe('XmlProcessor');
    });

    it('should return null for invalid file', () => {
      const processor = FileValidator.getProcessorForFile('nonexistent.file');
      expect(processor).toBe(null);
    });
  });

  describe('utility methods', () => {
    it('should return supported extensions', () => {
      const extensions = FileValidator.getSupportedExtensions();
      
      expect(extensions[FileType.CSV]).toContain('.csv');
      expect(extensions[FileType.EXCEL]).toContain('.xlsx');
      expect(extensions[FileType.XML]).toContain('.xml');
    });

    it('should check if file type is supported', () => {
      expect(FileValidator.isFileTypeSupported(path.join(testDataDir, 'test.csv'))).toBe(true);
      expect(FileValidator.isFileTypeSupported(path.join(testDataDir, 'test.xml'))).toBe(true);
      expect(FileValidator.isFileTypeSupported('nonexistent.file')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle files with multiple extensions', () => {
      const multiExtFile = path.join(testDataDir, 'data.backup.csv');
      fs.writeFileSync(multiExtFile, 'name,value\ntest,123', 'utf8');
      
      const result = FileValidator.validateFile(multiExtFile);
      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe(FileType.CSV);
      
      fs.unlinkSync(multiExtFile);
    });

    it('should handle very large files', () => {
      const largeFile = path.join(testDataDir, 'large.csv');
      let largeContent = 'name,value\n';
      for (let i = 0; i < 10000; i++) {
        largeContent += `item${i},${i}\n`;
      }
      fs.writeFileSync(largeFile, largeContent, 'utf8');
      
      const result = FileValidator.validateFile(largeFile);
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('large'))).toBe(false); // < 100MB
      
      fs.unlinkSync(largeFile);
    });

    it('should handle files with unusual separators', () => {
      const pipeFile = path.join(testDataDir, 'pipe-separated.txt');
      fs.writeFileSync(pipeFile, 'name|age|city\nJohn|30|NYC\nJane|25|LA', 'utf8');
      
      const result = FileValidator.detectFileType(pipeFile);
      expect(result.detectedType).toBe(FileType.CSV);
      
      fs.unlinkSync(pipeFile);
    });
  });
});