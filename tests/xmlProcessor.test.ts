import * as fs from 'fs';
import * as path from 'path';
import { XmlProcessor, XmlProcessorOptions } from '../src/processors/xmlProcessor';

describe('XmlProcessor', () => {
  let processor: XmlProcessor;
  const testDataDir = path.join(__dirname, 'xml-test-data');

  beforeEach(() => {
    processor = new XmlProcessor();
  });

  describe('Constructor and Options', () => {
    it('should create processor with default options', () => {
      const options = processor.getOptions();
      expect(options.encoding).toBe('utf8');
      expect(options.explicitArray).toBe(false);
      expect(options.trim).toBe(true);
      expect(options.ignoreAttrs).toBe(false);
    });

    it('should create processor with custom options', () => {
      const customOptions: XmlProcessorOptions = {
        explicitArray: true,
        ignoreAttrs: true,
        trim: false,
        parseBooleans: true
      };
      const customProcessor = new XmlProcessor(customOptions);
      const options = customProcessor.getOptions();
      expect(options.explicitArray).toBe(true);
      expect(options.ignoreAttrs).toBe(true);
      expect(options.trim).toBe(false);
      expect(options.parseBooleans).toBe(true);
    });

    it('should update options using setOptions', () => {
      processor.setOptions({ explicitArray: true, mergeAttrs: true });
      const options = processor.getOptions();
      expect(options.explicitArray).toBe(true);
      expect(options.mergeAttrs).toBe(true);
      expect(options.trim).toBe(true); // should preserve existing options
    });
  });

  describe('processFile', () => {
    const testXmlFile = path.join(testDataDir, 'test.xml');
    const emptyXmlFile = path.join(testDataDir, 'empty.xml');

    beforeAll(() => {
      // create test data directory
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // create test XML file
      const testXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="1" category="fiction">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price currency="USD">12.99</price>
  </book>
  <book id="2" category="science">
    <title>A Brief History of Time</title>
    <author>Stephen Hawking</author>
    <year>1988</year>
    <price currency="USD">15.99</price>
  </book>
  <metadata>
    <created>2023-01-01</created>
    <updated>2023-12-01</updated>
  </metadata>
</catalog>`;
      fs.writeFileSync(testXmlFile, testXmlContent, 'utf8');

      // create empty XML file
      fs.writeFileSync(emptyXmlFile, '', 'utf8');
    });

    afterAll(() => {
      // clean up test files
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should process a valid XML file', async () => {
      const result = await processor.processFile(testXmlFile);
      
      expect(result).toBeDefined();
      expect(result.fileName).toContain('test.xml');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.data.catalog).toBeDefined();
      expect(result.structure.rootElement).toBe('catalog');
      expect(result.structure.totalElements).toBeGreaterThan(0);
      expect(result.elements).toBeDefined();
      expect(result.elements.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent file', async () => {
      await expect(processor.processFile('nonexistent.xml')).rejects.toThrow('File not found');
    });

    it('should throw error for empty file', async () => {
      await expect(processor.processFile(emptyXmlFile)).rejects.toThrow('File is empty');
    });

    it('should handle XML with attributes correctly', async () => {
      const result = await processor.processFile(testXmlFile);
      
      expect(result.structure.attributes.size).toBeGreaterThan(0);
      // should detect attributes like 'id', 'category', 'currency'
      expect(result.structure.attributes.has('id')).toBe(true);
      expect(result.structure.attributes.has('category')).toBe(true);
    });
  });

  describe('validateXml', () => {
    const testXmlFile = path.join(testDataDir, 'test.xml');
    const invalidXmlFile = path.join(testDataDir, 'invalid.xml');
    const malformedXmlFile = path.join(testDataDir, 'malformed.xml');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // valid XML
      const validXml = `<?xml version="1.0"?>
<root>
  <item>Test</item>
</root>`;
      fs.writeFileSync(testXmlFile, validXml, 'utf8');

      // invalid XML  
      const invalidXml = `<?xml version="1.0"?>
<root>
  <item>Test</item>
`;
      fs.writeFileSync(invalidXmlFile, invalidXml, 'utf8');

      // malformed XML (non-XML content)
      const malformedXml = `This is not XML content
<root><item>Test</item></root>`;
      fs.writeFileSync(malformedXmlFile, malformedXml, 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should validate a correct XML file', () => {
      const validation = processor.validateXml(testXmlFile);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.fileInfo?.size).toBeGreaterThan(0);
    });

    it('should detect non-existent file', () => {
      const validation = processor.validateXml('nonexistent.xml');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('File not found: nonexistent.xml');
    });

    it('should detect malformed XML', () => {
      const validation = processor.validateXml(malformedXmlFile);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('XML syntax error') || error.includes('XML parsing error'))).toBe(true);
    });

    it('should warn about non-xml extension', () => {
      const txtFile = path.join(testDataDir, 'test.txt');
      fs.writeFileSync(txtFile, '<?xml version="1.0"?><root><item>Test</item></root>', 'utf8');
      
      const validation = processor.validateXml(txtFile);
      expect(validation.warnings.some(warning => warning.includes('expected XML format'))).toBe(true);
      
      fs.unlinkSync(txtFile);
    });
  });

  describe('convertToJSON', () => {
    const testXmlFile = path.join(testDataDir, 'convert-test.xml');
    const outputJsonFile = path.join(testDataDir, 'output.json');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0"?>
<products>
  <product id="1">
    <name>Laptop</name>
    <price>999</price>
  </product>
  <product id="2">
    <name>Mouse</name>
    <price>25</price>
  </product>
</products>`;
      fs.writeFileSync(testXmlFile, xmlContent, 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should convert XML to JSON string', async () => {
      const jsonString = await processor.convertToJSON(testXmlFile);
      
      expect(jsonString).toBeDefined();
      expect(typeof jsonString).toBe('string');
      
      const parsed = JSON.parse(jsonString);
      expect(parsed.fileName).toContain('convert-test.xml');
      expect(parsed.data).toBeDefined();
      expect(parsed.structure).toBeDefined();
    });

    it('should save JSON to file when output path provided', async () => {
      const result = await processor.convertToJSON(testXmlFile, outputJsonFile);
      
      expect(result).toBe(outputJsonFile);
      expect(fs.existsSync(outputJsonFile)).toBe(true);
      
      const content = fs.readFileSync(outputJsonFile, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.data.products).toBeDefined();
    });
  });

  describe('getStatistics', () => {
    const testXmlFile = path.join(testDataDir, 'stats-test.xml');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0"?>
<library xmlns:book="http://example.com/book">
  <book:novel id="1" genre="fiction">
    <title>Novel Title</title>
    <author name="John Doe">Author Bio</author>
    <chapters count="12"/>
  </book:novel>
  <book:textbook id="2" subject="science">
    <title>Science Book</title>
    <author name="Jane Smith">Author Bio</author>
    <chapters count="20"/>
  </book:textbook>
  <metadata created="2023-01-01">
    <version>1.0</version>
  </metadata>
</library>`;
      fs.writeFileSync(testXmlFile, xmlContent, 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should get file statistics', async () => {
      const stats = await processor.getStatistics(testXmlFile);
      
      expect(stats.totalElements).toBeGreaterThan(0);
      expect(stats.totalAttributes).toBeGreaterThan(0);
      expect(stats.maxDepth).toBeGreaterThan(0);
      expect(stats.fileSize).toBeGreaterThan(0);
      expect(stats.uniqueElements).toBeGreaterThan(0);
      expect(stats.uniqueAttributes).toBeGreaterThan(0);
      expect(stats.hasNamespaces).toBe(true);
      expect(stats.rootElement).toBe('library');
    });
  });

  describe('getPreview', () => {
    const testXmlFile = path.join(testDataDir, 'preview-test.xml');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0"?>
<data>
  <level1>
    <level2>
      <level3>
        <level4>
          <deep>Very deep content</deep>
        </level4>
      </level3>
    </level2>
  </level1>
  <items>
    <item id="1">Item 1</item>
    <item id="2">Item 2</item>
    <item id="3">Item 3</item>
    <item id="4">Item 4</item>
    <item id="5">Item 5</item>
    <item id="6">Item 6</item>
  </items>
</data>`;
      fs.writeFileSync(testXmlFile, xmlContent, 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should get limited preview of XML structure', async () => {
      const preview = await processor.getPreview(testXmlFile, 2);
      
      expect(preview).toBeDefined();
      expect(preview.elements.length).toBeLessThanOrEqual(20); // limit 20 elements
      expect(JSON.stringify(preview.data)).toContain('truncated for preview');
    });

    it('should respect maxDepth parameter', async () => {
      const preview = await processor.getPreview(testXmlFile, 1);
      
      const dataString = JSON.stringify(preview.data);
      expect(dataString).toContain('truncated for preview');
    });
  });

  describe('getElementsPaths', () => {
    const testXmlFile = path.join(testDataDir, 'paths-test.xml');

    beforeAll(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0"?>
<root>
  <section>
    <item>Item 1</item>
    <item>Item 2</item>
  </section>
  <footer>Footer content</footer>
</root>`;
      fs.writeFileSync(testXmlFile, xmlContent, 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    it('should get all element paths', async () => {
      const paths = await processor.getElementsPaths(testXmlFile);
      
      expect(paths).toBeDefined();
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths).toContain('root');
    });
  });
});