import * as fs from 'fs';
import * as path from 'path';

export interface FileValidationResult {
  isValid: boolean;
  fileType: FileType | null;
  errors: string[];
  warnings: string[];
  fileInfo: {
    path: string;
    size: number;
    extension: string;
    mimeType?: string;
  };
}

export enum FileType {
  CSV = 'csv',
  EXCEL = 'excel', 
  XML = 'xml'
}

export interface FileTypeDetectionResult {
  detectedType: FileType | null;
  confidence: number; // 0-1 scale
  reasons: string[];
}

export class FileValidator {
  private static readonly CSV_EXTENSIONS = ['.csv', '.tsv', '.txt'];
  private static readonly EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb'];
  private static readonly XML_EXTENSIONS = ['.xml', '.xsd', '.xsl', '.xslt', '.rss', '.atom', '.svg'];
  
  private static readonly CSV_SEPARATORS = [',', ';', '\t', '|'];
  private static readonly MAX_SAMPLE_SIZE = 8192; // 8KB sample for content analysis

  public static validateFile(filePath: string): FileValidationResult {
    const result: FileValidationResult = {
      isValid: true,
      fileType: null,
      errors: [],
      warnings: [],
      fileInfo: {
        path: filePath,
        size: 0,
        extension: ''
      }
    };

    try {
      // check if file exists
      if (!fs.existsSync(filePath)) {
        result.errors.push(`File not found: ${filePath}`);
        result.isValid = false;
        return result;
      }

      // get file stats
      const stats = fs.statSync(filePath);
      const extension = path.extname(filePath).toLowerCase();
      
      result.fileInfo.size = stats.size;
      result.fileInfo.extension = extension;

      // check if file is empty
      if (stats.size === 0) {
        result.errors.push('File is empty');
        result.isValid = false;
        return result;
      }

      // detect file type
      const detection = this.detectFileType(filePath);
      result.fileType = detection.detectedType;

      // add confidence-based warning
      if (detection.confidence < 0.7) {
        result.warnings.push(`File type detection confidence is low (${(detection.confidence * 100).toFixed(1)}%)`);
        result.warnings.push(`Detection reasons: ${detection.reasons.join(', ')}`);
      }

      // file size warning
      if (stats.size > 100 * 1024 * 1024) { // 100MB
        result.warnings.push('File is very large (>100MB), processing might be slow');
      }

      // no valid file type detected
      if (!result.fileType) {
        result.errors.push('Unable to determine file type. Supported types: CSV, Excel (.xlsx, .xls), XML');
        result.isValid = false;
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  public static detectFileType(filePath: string): FileTypeDetectionResult {
    const result: FileTypeDetectionResult = {
      detectedType: null,
      confidence: 0,
      reasons: []
    };

    try {
      const extension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath).toLowerCase();
      
      // read file sample for content analysis
      let contentSample = '';
      if (fs.existsSync(filePath)) {
        const fileSize = fs.statSync(filePath).size;
        const sampleSize = Math.min(this.MAX_SAMPLE_SIZE, fileSize);
        
        try {
          const buffer = Buffer.alloc(sampleSize);
          const fd = fs.openSync(filePath, 'r');
          try {
            fs.readSync(fd, buffer, 0, sampleSize, 0);
            contentSample = buffer.toString('utf8');
          } finally {
            fs.closeSync(fd);
          }
        } catch (error) {
          // If file reading fails, continue without content analysis
          result.reasons.push(`Content analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // detection strategies
      const extensionScore = this.scoreByExtension(extension);
      const contentScore = this.scoreByContent(contentSample);
      const filenameScore = this.scoreByFilename(fileName);

      // combine scores and determine best match
      const csvScore = extensionScore.csv + contentScore.csv + filenameScore.csv;
      const excelScore = extensionScore.excel + contentScore.excel + filenameScore.excel;
      const xmlScore = extensionScore.xml + contentScore.xml + filenameScore.xml;

      const maxScore = Math.max(csvScore, excelScore, xmlScore);
      
      if (maxScore > 0) {
        if (csvScore === maxScore) {
          result.detectedType = FileType.CSV;
          result.confidence = Math.min(csvScore / 3, 1); // Max 3 points
          result.reasons.push('CSV indicators found');
        } else if (excelScore === maxScore) {
          result.detectedType = FileType.EXCEL;
          result.confidence = Math.min(excelScore / 3, 1);
          result.reasons.push('Excel indicators found');
        } else {
          result.detectedType = FileType.XML;
          result.confidence = Math.min(xmlScore / 3, 1);
          result.reasons.push('XML indicators found');
        }

        // add specific reasons
        if (extensionScore[result.detectedType] > 0) {
          result.reasons.push(`File extension matches ${result.detectedType.toUpperCase()}`);
        }
        if (contentScore[result.detectedType] > 0) {
          result.reasons.push(`File content matches ${result.detectedType.toUpperCase()} format`);
        }
        if (filenameScore[result.detectedType] > 0) {
          result.reasons.push(`Filename suggests ${result.detectedType.toUpperCase()} format`);
        }
      }

    } catch (error) {
      result.reasons.push(`Detection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private static scoreByExtension(extension: string): Record<string, number> {
    const scores = { csv: 0, excel: 0, xml: 0 };

    if (this.CSV_EXTENSIONS.includes(extension)) {
      scores.csv = 1;
    } else if (this.EXCEL_EXTENSIONS.includes(extension)) {
      scores.excel = 1;
    } else if (this.XML_EXTENSIONS.includes(extension)) {
      scores.xml = 1;
    }

    return scores;
  }

  private static scoreByContent(content: string): Record<string, number> {
    const scores = { csv: 0, excel: 0, xml: 0 };
    
    if (!content || content.length === 0) {
      return scores;
    }

    // XML detection
    const trimmedContent = content.trim();
    if (trimmedContent.startsWith('<?xml') || trimmedContent.startsWith('<')) {
      // check for XML structure
      const xmlTagCount = (content.match(/<[^>]+>/g) || []).length;
      const xmlClosingTagCount = (content.match(/<\/[^>]+>/g) || []).length;
      
      if (xmlTagCount > 0 && xmlClosingTagCount > 0) {
        scores.xml = 1;
      } else if (xmlTagCount > 0) {
        scores.xml = 0.7;
      }
    }

    // excel detection (binary signatures)
    const bytes = Buffer.from(content, 'utf8');
    if (bytes.length >= 8) {
      // xlsx signature (ZIP-based)
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        scores.excel = 1;
      }
      // XLS signature (OLE-based)
      else if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
        scores.excel = 1;
      }
    }

    // CSV detection
    if (scores.xml === 0 && scores.excel === 0) {
      // check for CSV-like patterns
      const lines = content.split('\n').slice(0, 10); // check first 10 lines
      let csvIndicators = 0;
      
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        
        // check for common separators
        for (const sep of this.CSV_SEPARATORS) {
          if (line.includes(sep)) {
            csvIndicators++;
            break;
          }
        }
      }
      
      // at least 50% of lines have separators
      if (csvIndicators >= lines.length * 0.5) { 
        scores.csv = 1;
      } else if (csvIndicators > 0) {
        scores.csv = 0.5;
      }
    }

    return scores;
  }

  private static scoreByFilename(filename: string): Record<string, number> {
    const scores = { csv: 0, excel: 0, xml: 0 };

    // CSV filename patterns
    if (filename.includes('csv') || filename.includes('data') || filename.includes('export')) {
      scores.csv = 0.3;
    }

    // Excel filename patterns  
    if (filename.includes('xlsx') || filename.includes('xls') || filename.includes('spreadsheet') || filename.includes('workbook')) {
      scores.excel = 0.3;
    }

    // XML filename patterns
    if (filename.includes('xml') || filename.includes('config') || filename.includes('feed') || filename.includes('rss')) {
      scores.xml = 0.3;
    }

    return scores;
  }

  public static getProcessorForFile(filePath: string): string | null {
    const validation = this.validateFile(filePath);
    
    if (!validation.isValid || !validation.fileType) {
      return null;
    }

    switch (validation.fileType) {
      case FileType.CSV:
        return 'CSVProcessor';
      case FileType.EXCEL:
        return 'ExcelProcessor';
      case FileType.XML:
        return 'XmlProcessor';
      default:
        return null;
    }
  }

  public static getSupportedExtensions(): { [key in FileType]: string[] } {
    return {
      [FileType.CSV]: this.CSV_EXTENSIONS,
      [FileType.EXCEL]: this.EXCEL_EXTENSIONS,
      [FileType.XML]: this.XML_EXTENSIONS
    };
  }

  public static isFileTypeSupported(filePath: string): boolean {
    const validation = this.validateFile(filePath);
    return validation.isValid && validation.fileType !== null;
  }
}

export default FileValidator;