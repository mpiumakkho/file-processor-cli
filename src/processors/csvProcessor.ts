import csv from 'csv-parser';
import * as fs from 'fs';
import { Readable } from 'stream';

export interface CSVProcessorOptions {
  delimiter?: string;
  headers?: boolean;
  skipEmptyLines?: boolean;
  encoding?: BufferEncoding;
}

export interface CSVProcessorResult {
  data: Record<string, any>[];
  rowCount: number;
  headers: string[];
  processingTime: number;
  fileName?: string;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class CSVProcessor {
  private options: CSVProcessorOptions;

  constructor(options: CSVProcessorOptions = {}) {
    this.options = {
      delimiter: ',',
      headers: true,
      skipEmptyLines: true,
      encoding: 'utf8',
      ...options
    };
  }
}

export default CSVProcessor;
