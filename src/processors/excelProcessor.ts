import * as fs from 'fs';
import * as XLSX from 'xlsx';

export interface ExcelProcessorOptions {
  encoding?: BufferEncoding;
  sheetIndex?: number;
  sheetName?: string;
  range?: string;
  header?: number | string[] | 'A';
}

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  range: string;
}

export interface ExcelProcessorResult {
  data: Record<string, any>[];
  sheetInfo: ExcelSheetInfo;
  allSheets: ExcelSheetInfo[];
  processingTime: number;
  fileName?: string;
}

export interface ExcelValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    size: number;
    sheets: string[];
  };
}

export interface ExcelStatistics {
  totalSheets: number;
  totalRows: number;
  totalCells: number;
  fileSize: number;
  sheets: ExcelSheetInfo[];
}

export class ExcelProcessor {
  private options: ExcelProcessorOptions;

  constructor(options: ExcelProcessorOptions = {}) {
    this.options = {
      encoding: 'binary',
      sheetIndex: 0,
      // don't set header by default - let XLSX use first row as header automatically
      ...options
    };
  }

  public async processFile(filePath: string): Promise<ExcelProcessorResult> {
    const startTime = Date.now();
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const allSheets = this.getAllSheetsInfo(workbook);
      
      let targetSheet: string;
      if (this.options.sheetName) {
        targetSheet = this.options.sheetName;
        if (!workbook.SheetNames.includes(targetSheet)) {
          throw new Error(`Sheet "${targetSheet}" not found`);
        }
      } else {
        const sheetIndex = this.options.sheetIndex || 0;
        targetSheet = workbook.SheetNames[sheetIndex];
        if (!targetSheet) {
          throw new Error(`Sheet index ${sheetIndex} not found`);
        }
      }

      const worksheet = workbook.Sheets[targetSheet];
      const sheetOptions: any = {
        defval: null
      };
      
      if (this.options.header !== undefined) {
        sheetOptions.header = this.options.header;
      }
      
      if (this.options.range) {
        sheetOptions.range = this.options.range;
      }

      const data = XLSX.utils.sheet_to_json(worksheet, sheetOptions) as Record<string, any>[];

      const sheetInfo = this.getSheetInfo(worksheet, targetSheet);
      const processingTime = Date.now() - startTime;
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';

      return {
        data,
        sheetInfo,
        allSheets,
        processingTime,
        fileName
      };
    } catch (error) {
      throw new Error(`Excel processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async processSheet(filePath: string, sheetName: string): Promise<ExcelProcessorResult> {
    const originalSheetName = this.options.sheetName;
    this.options.sheetName = sheetName;
    
    try {
      const result = await this.processFile(filePath);
      return result;
    } finally {
      if (originalSheetName !== undefined) {
        this.options.sheetName = originalSheetName;
      } else {
        delete this.options.sheetName;
      }
    }
  }

  public async getAllSheets(filePath: string): Promise<Record<string, ExcelProcessorResult>> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    const results: Record<string, ExcelProcessorResult> = {};

    for (const sheetName of workbook.SheetNames) {
      try {
        results[sheetName] = await this.processSheet(filePath, sheetName);
      } catch (error) {
        console.warn(`Warning: Could not process sheet "${sheetName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  public validateExcel(filePath: string): ExcelValidationResult {
    const result: ExcelValidationResult = {
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
      if (!['xlsx', 'xls', 'xlsm', 'xlsb'].includes(fileExtension || '')) {
        result.warnings.push(`File extension is '${fileExtension}', expected Excel format (.xlsx, .xls, .xlsm, .xlsb)`);
      }

      if (stats.size > 50 * 1024 * 1024) { // 50MB warning
        result.warnings.push('File size is very large (>50MB), processing might be slow');
      }

      const workbook = XLSX.readFile(filePath);
      const sheets = workbook.SheetNames;

      if (sheets.length === 0) {
        result.errors.push('No sheets found in the Excel file');
        result.isValid = false;
        return result;
      }

      result.fileInfo = {
        size: stats.size,
        sheets: sheets
      };

      if (sheets.length > 10) {
        result.warnings.push(`File contains many sheets (${sheets.length}), processing might take time`);
      }

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
      sheetInfo: result.sheetInfo,
      allSheets: result.allSheets,
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

  public async getStatistics(filePath: string): Promise<ExcelStatistics> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const workbook = XLSX.readFile(filePath);
    const allSheets = this.getAllSheetsInfo(workbook);
    
    const totalRows = allSheets.reduce((sum, sheet) => sum + sheet.rowCount, 0);
    const totalCells = allSheets.reduce((sum, sheet) => sum + (sheet.rowCount * sheet.columnCount), 0);

    return {
      totalSheets: allSheets.length,
      totalRows,
      totalCells,
      fileSize: stats.size,
      sheets: allSheets
    };
  }

  public async getPreview(filePath: string, rows: number = 5, sheetName?: string): Promise<ExcelProcessorResult> {
    const originalHeader = this.options.header;
    const originalSheetName = this.options.sheetName;
    
    // set options for preview - use default behavior for headers
    if (sheetName) {
      this.options.sheetName = sheetName;
    }
    
    try {
      const fullResult = await this.processFile(filePath);
      
      return {
        ...fullResult,
        data: fullResult.data.slice(0, rows)
      };
    } finally {
      // restore original options
      if (originalHeader !== undefined) {
        this.options.header = originalHeader;
      } else {
        delete this.options.header;
      }
      
      if (originalSheetName !== undefined) {
        this.options.sheetName = originalSheetName;
      } else {
        delete this.options.sheetName;
      }
    }
  }

  private getAllSheetsInfo(workbook: XLSX.WorkBook): ExcelSheetInfo[] {
    return workbook.SheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      return this.getSheetInfo(worksheet, sheetName);
    });
  }

  private getSheetInfo(worksheet: XLSX.WorkSheet, sheetName: string): ExcelSheetInfo {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const rowCount = range.e.r + 1;
    const columnCount = range.e.c + 1;

    return {
      name: sheetName,
      rowCount,
      columnCount,
      range: worksheet['!ref'] || 'A1:A1'
    };
  }

  public setOptions(options: Partial<ExcelProcessorOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public getOptions(): ExcelProcessorOptions {
    return { ...this.options };
  }

  public getSheetNames(filePath: string): string[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    return workbook.SheetNames;
  }
}

export default ExcelProcessor;