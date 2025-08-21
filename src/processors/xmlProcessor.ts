import * as fs from 'fs';
import * as xml2js from 'xml2js';

export interface XmlProcessorOptions {
  encoding?: BufferEncoding;
  explicitArray?: boolean;
  trim?: boolean;
  ignoreAttrs?: boolean;
  mergeAttrs?: boolean;
  explicitRoot?: boolean;
  normalize?: boolean;
  parseBooleans?: boolean;
  parseNumbers?: boolean;
}

export interface XmlElement {
  name: string;
  attributes?: Record<string, any>;
  children?: XmlElement[];
  value?: string;
  path: string;
}

export interface XmlStructureInfo {
  rootElement: string;
  totalElements: number;
  maxDepth: number;
  namespaces: string[];
  elements: Set<string>;
  attributes: Set<string>;
}

export interface XmlProcessorResult {
  data: Record<string, any>;
  structure: XmlStructureInfo;
  elements: XmlElement[];
  processingTime: number;
  fileName?: string;
}

export interface XmlValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    size: number;
    encoding?: string;
  };
}

export interface XmlStatistics {
  totalElements: number;
  totalAttributes: number;
  maxDepth: number;
  fileSize: number;
  uniqueElements: number;
  uniqueAttributes: number;
  hasNamespaces: boolean;
  rootElement: string;
}

export class XmlProcessor {
  private options: XmlProcessorOptions;
  private parser: xml2js.Parser;

  constructor(options: XmlProcessorOptions = {}) {
    this.options = {
      encoding: 'utf8',
      explicitArray: false,
      trim: true,
      ignoreAttrs: false,
      mergeAttrs: false,
      explicitRoot: true,
      normalize: false,
      parseBooleans: false,
      parseNumbers: false,
      ...options
    };

    this.parser = new xml2js.Parser(this.options);
  }

  public async processFile(filePath: string): Promise<XmlProcessorResult> {
    const startTime = Date.now();
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }

    try {
      const xmlContent = fs.readFileSync(filePath, { encoding: this.options.encoding });
      const contentString = typeof xmlContent === 'string' ? xmlContent : xmlContent.toString();
      
      if (contentString.trim().length === 0) {
        throw new Error('XML file contains no content');
      }

      const result = await this.parser.parseStringPromise(contentString);
      const structure = this.analyzeStructure(result);
      const elements = this.flattenElements(result);
      
      const processingTime = Date.now() - startTime;
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';

      return {
        data: result,
        structure,
        elements,
        processingTime,
        fileName
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Non-whitespace before first tag')) {
        throw new Error('Invalid XML: File contains non-XML content before the root element');
      }
      throw new Error(`XML processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public validateXml(filePath: string): XmlValidationResult {
    const result: XmlValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      if (!fs.existsSync(filePath)) {
        result.errors.push(`File not found: ${filePath}`);
        result.isValid = false;
        return result;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        result.errors.push('File is empty');
        result.isValid = false;
        return result;
      }

      const fileExtension = filePath.toLowerCase().split('.').pop();
      if (!['xml', 'xsd', 'xsl', 'xslt', 'rss', 'atom', 'svg'].includes(fileExtension || '')) {
        result.warnings.push(`File extension is '${fileExtension}', expected XML format (.xml, .xsd, .xsl, etc.)`);
      }

      if (stats.size > 20 * 1024 * 1024) { // 20MB warning
        result.warnings.push('File size is very large (>20MB), processing might be slow');
      }

      const content = fs.readFileSync(filePath, 'utf8');
      
      // basic XML validation checks
      if (!content.trim().startsWith('<')) {
        result.errors.push('Invalid XML: File does not start with an XML tag');
        result.isValid = false;
      }

      if (!content.includes('</')) {
        result.warnings.push('XML file might be self-closing only or malformed');
      }

      // check common XML declaration
      if (!content.startsWith('<?xml')) {
        result.warnings.push('XML file is missing XML declaration (<?xml version="1.0"?>)');
      }

      // try to parse to catch syntax errors
      try {
        this.parser.parseString(content, (err) => {
          if (err) {
            result.errors.push(`XML syntax error: ${err.message}`);
            result.isValid = false;
          }
        });
      } catch (error) {
        result.errors.push(`XML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.isValid = false;
      }

      result.fileInfo = {
        size: stats.size
      };

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  public async convertToJSON(filePath: string, outputPath?: string): Promise<string> {
    const result = await this.processFile(filePath);
    const jsonData = {
      fileName: result.fileName,
      structure: {
        ...result.structure,
        elements: Array.from(result.structure.elements),
        attributes: Array.from(result.structure.attributes)
      },
      data: result.data,
      processingTime: result.processingTime
    };
    
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    if (outputPath) {
      fs.writeFileSync(outputPath, jsonString, { encoding: 'utf8' });
      return outputPath;
    }
    
    return jsonString;
  }

  public async getStatistics(filePath: string): Promise<XmlStatistics> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const result = await this.processFile(filePath);

    return {
      totalElements: result.structure.totalElements,
      totalAttributes: this.countTotalAttributes(result.data),
      maxDepth: result.structure.maxDepth,
      fileSize: stats.size,
      uniqueElements: result.structure.elements.size,
      uniqueAttributes: result.structure.attributes.size,
      hasNamespaces: result.structure.namespaces.length > 0,
      rootElement: result.structure.rootElement
    };
  }

  public async getPreview(filePath: string, maxDepth: number = 3): Promise<XmlProcessorResult> {
    const result = await this.processFile(filePath);
    
    // Create a preview by limiting the depth of the data structure
    const previewData = this.limitDepth(result.data, maxDepth);
    
    return {
      ...result,
      data: previewData,
      elements: result.elements.slice(0, 20) // limit first 20 elements for preview
    };
  }

  private analyzeStructure(data: any, path: string = '', depth: number = 0): XmlStructureInfo {
    const structure: XmlStructureInfo = {
      rootElement: '',
      totalElements: 0,
      maxDepth: depth,
      namespaces: [],
      elements: new Set(),
      attributes: new Set()
    };

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (depth === 0) {
          structure.rootElement = key;
        }

        structure.elements.add(key);
        structure.totalElements++;

        // check for namespaces
        if (key.includes(':')) {
          const namespace = key.split(':')[0];
          if (!structure.namespaces.includes(namespace)) {
            structure.namespaces.push(namespace);
          }
        }

        // check for attributes (usually prefixed with $ in xml2js)
        if (key === '$' && typeof value === 'object' && value !== null) {
          Object.keys(value as Record<string, any>).forEach(attr => structure.attributes.add(attr));
        }

        if (typeof value === 'object' && value !== null) {
          const childStructure = this.analyzeStructure(
            value, 
            path ? `${path}.${key}` : key, 
            depth + 1
          );
          
          structure.totalElements += childStructure.totalElements;
          structure.maxDepth = Math.max(structure.maxDepth, childStructure.maxDepth);
          
          childStructure.elements.forEach(el => structure.elements.add(el));
          childStructure.attributes.forEach(attr => structure.attributes.add(attr));
          childStructure.namespaces.forEach(ns => {
            if (!structure.namespaces.includes(ns)) {
              structure.namespaces.push(ns);
            }
          });
        }
      }
    }

    return structure;
  }

  private flattenElements(data: any, path: string = '', elements: XmlElement[] = []): XmlElement[] {
    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        const element: XmlElement = {
          name: key,
          path: currentPath
        };

        // handle attributes
        if (typeof value === 'object' && value !== null && '$' in value) {
          element.attributes = (value as any)['$'] as Record<string, any>;
        }

        // handle text content
        if (typeof value === 'string' || typeof value === 'number') {
          element.value = String(value);
        }

        // handle children
        if (typeof value === 'object' && value !== null) {
          const children: XmlElement[] = [];
          this.flattenElements(value, currentPath, children);
          if (children.length > 0) {
            element.children = children;
          }
        }

        elements.push(element);
      }
    }

    return elements;
  }

  private countTotalAttributes(data: any): number {
    let count = 0;
    
    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (key === '$' && typeof value === 'object' && value !== null) {
          count += Object.keys(value as Record<string, any>).length;
        }
        
        if (typeof value === 'object' && value !== null) {
          count += this.countTotalAttributes(value);
        }
      }
    }
    
    return count;
  }

  private limitDepth(data: any, maxDepth: number, currentDepth: number = 0): any {
    if (currentDepth >= maxDepth) {
      return '[... truncated for preview]';
    }

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.slice(0, 3).map(item => this.limitDepth(item, maxDepth, currentDepth + 1));
    }

    const result: any = {};
    let count = 0;
    for (const [key, value] of Object.entries(data)) {
      // limit 5 properties per level in preview
      if (count >= 5) { 
        result['...'] = `${Object.keys(data).length - count} more properties`;
        break;
      }
      result[key] = this.limitDepth(value, maxDepth, currentDepth + 1);
      count++;
    }
    
    return result;
  }

  public setOptions(options: Partial<XmlProcessorOptions>): void {
    this.options = { ...this.options, ...options };
    this.parser = new xml2js.Parser(this.options);
  }

  public getOptions(): XmlProcessorOptions {
    return { ...this.options };
  }

  public getElementsPaths(filePath: string): Promise<string[]> {
    return this.processFile(filePath).then(result => {
      return result.elements.map(element => element.path);
    });
  }
}

export default XmlProcessor;