import csv from 'csv-parser';
import * as fs from 'fs';
import { Readable } from 'stream';

// options for CSV processing setting
export interface CSVProcessorOptions {
  delimiter?: string;
  headers?: boolean;
  skipEmptyLines?: boolean;
  encoding?: BufferEncoding;
}

// result object returned after CSV processing
export interface CSVProcessorResult {
  data: Record<string, any>[];
  rowCount: number;
  headers: string[];
  processingTime: number;
  fileName?: string | undefined;
}

// validation result for CSV file checking
export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class CSVProcessor {
  private options: CSVProcessorOptions;

  // constructor - setup CSV processor with option
  constructor(options: CSVProcessorOptions = {}) {
    this.options = {
      delimiter: ',',
      headers: true,
      skipEmptyLines: true,
      encoding: 'utf8',
      ...options
    };
  }

  // process a CSV file from disk - reads file, parses headers, converts to objects, measures time, handles large file
  public async processFile(filePath: string): Promise<CSVProcessorResult> {
    const startTime = Date.now();
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      const results: Record<string, any>[] = [];
      let headers: string[] = [];

      fs.createReadStream(filePath, { encoding: this.options.encoding })
        .pipe(csv({
          separator: this.options.delimiter || ',',
          headers: true
        }))
        .on('headers', (headerList: string[]) => {
          headers = headerList;
        })
        .on('data', (data: Record<string, any>) => {
          results.push(data);
        })
        .on('end', () => {
          const processingTime = Date.now() - startTime;
          const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
          resolve({
            data: results,
            rowCount: results.length,
            headers,
            processingTime,
            fileName
          });
        })
        .on('error', (error) => {
          reject(new Error(`CSV processing error: ${error.message}`));
        });
    });
  }

  // process CSV data from a string - useful for API responses, memory efficient for large string
  public async processString(csvString: string): Promise<CSVProcessorResult> {
    const startTime = Date.now();
    
    if (!csvString.trim()) {
      throw new Error('CSV string is empty');
    }

    return new Promise((resolve, reject) => {
      const results: Record<string, any>[] = [];
      let headers: string[] = [];
      let isFirstRow = true;

      const readable = new Readable();
      readable.push(csvString);
      readable.push(null);

      readable
        .pipe(csv({
          separator: this.options.delimiter || ',',
          headers: this.options.headers || true
        }))
        .on('headers', (headerList: string[]) => {
          headers = headerList;
        })
        .on('data', (data: Record<string, any>) => {
          if (isFirstRow && !this.options.headers) {
            headers = Object.keys(data);
            isFirstRow = false;
          }
          results.push(data);
        })
        .on('end', () => {
          const processingTime = Date.now() - startTime;
          resolve({
            data: results,
            rowCount: results.length,
            headers,
            processingTime
          });
        })
        .on('error', (error) => {
          reject(new Error(`CSV processing error: ${error.message}`));
        });
    });
  }

  // validate CSV file before processing - checks file exists, size, extension, column counts, provides errors/warning
  public validateCSV(filePath: string): CSVValidationResult {
    const result: CSVValidationResult = {
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

      if (stats.size > 100 * 1024 * 1024) { // 100MB warning
        result.warnings.push('File size is very large (>100MB), processing might be slow');
      }

      const fileExtension = filePath.toLowerCase().split('.').pop();
      if (fileExtension !== 'csv') {
        result.warnings.push(`File extension is '${fileExtension}', expected 'csv'`);
      }

      const content = fs.readFileSync(filePath, { encoding: this.options.encoding, flag: 'r' }) as string;
      const lines = content.split('\n').filter((line: string) => line.trim());
      
      if (lines.length === 0) {
        result.errors.push('No content lines found');
        result.isValid = false;
        return result;
      }

      if (lines.length === 1 && this.options.headers) {
        result.warnings.push('Only header row found, no data rows');
      }

      const firstLineColumns = lines[0].split(this.options.delimiter || ',').length;
      const inconsistentRows = lines.slice(1).filter((line: string) => {
        const columns = line.split(this.options.delimiter || ',').length;
        return columns !== firstLineColumns;
      });

      if (inconsistentRows.length > 0) {
        result.warnings.push(`${inconsistentRows.length} rows have inconsistent column counts`);
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  // convert CSV file to JSON format - convert data to JSON string, optionally saves to file, print output
  public async convertToJSON(filePath: string, outputPath?: string): Promise<string> {
    const result = await this.processFile(filePath);
    const jsonString = JSON.stringify(result.data, null, 2);
    
    if (outputPath) {
      fs.writeFileSync(outputPath, jsonString, { encoding: 'utf8' });
      return outputPath;
    }
    
    return jsonString;
  }

  // get preview of CSV file (first N rows) - shows first N rows without processing entire file, memory efficient for large files
  public async getPreview(filePath: string, rows: number = 5): Promise<CSVProcessorResult> {
    const fullResult = await this.processFile(filePath);
    
    return {
      ...fullResult,
      data: fullResult.data.slice(0, rows),
      rowCount: Math.min(rows, fullResult.rowCount)
    };
  }

  // get stats CSV file - counts rows/columns, shows file size/encoding, lists header, useful for analysis
  public async getStatistics(filePath: string): Promise<{
    totalRows: number;
    totalColumns: number;
    headers: string[];
    fileSize: number;
    encoding: string;
  }> {
    const result = await this.processFile(filePath);
    const stats = fs.statSync(filePath);
    
    return {
      totalRows: result.rowCount,
      totalColumns: result.headers.length,
      headers: result.headers,
      fileSize: stats.size,
      encoding: this.options.encoding || 'utf8'
    };
  }

  // update processor options - change delimiter, headers, encoding settings, merge with existing option
  public setOptions(options: Partial<CSVProcessorOptions>): void {
    this.options = { ...this.options, ...options };
  }

  // get current processor options
  public getOptions(): CSVProcessorOptions {
    return { ...this.options };
  }
}
export default CSVProcessor;