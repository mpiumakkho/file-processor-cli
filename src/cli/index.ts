#!/usr/bin/env node

import { Command } from 'commander';
import CSVProcessor from '../processors/csvProcessor';
import ExcelProcessor from '../processors/excelProcessor';
import XmlProcessor from '../processors/xmlProcessor';

const program = new Command();

program
  .name('file-processor')
  .description('CLI tool for processing CSV, Excel, and XML files')
  .version('1.0.0');

program
  .command('test-csv')
  .description('Test CSV processing with sample file')
  .argument('[file]', 'CSV file to test', './data/samples/csv/fish-monetary-stock-account-1996-2019.csv')
  .action(async (file) => {
    try {
      console.log(`Testing CSV file: ${file}`);
      
      const processor = new CSVProcessor();
      
      // get stats
      const stats = await processor.getStatistics(file);
      console.log(`\nFile Statistics:`);
      console.log(`- Total rows: ${stats.totalRows}`);
      console.log(`- Total columns: ${stats.totalColumns}`);
      console.log(`- File size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
      
      // get preview
      const preview = await processor.getPreview(file, 3);
      console.log(`\nPreview (first 3 rows):`);
      console.log(JSON.stringify(preview.data, null, 2));
      
      // process full file
      console.log(`\nProcessing full file...`);
      const startTime = Date.now();
      const result = await processor.processFile(file);
      const totalTime = Date.now() - startTime;
      
      console.log(`Processing completed in ${totalTime}ms`);
      console.log(`Total rows processed: ${result.rowCount}`);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

program
  .command('convert-csv')
  .description('Convert CSV file to JSON format')
  .argument('<input>', 'Input CSV file path')
  .option('-o, --output <path>', 'Output JSON file path (optional)')
  .option('-p, --preview <rows>', 'Show preview of first N rows', '5')
  .action(async (input, options) => {
    try {
      console.log(`Converting CSV to JSON: ${input}`);
      
      const processor = new CSVProcessor();
      
      // validate file first
      const validation = processor.validateCSV(input);
      if (!validation.isValid) {
        console.error('Validation errors:');
        validation.errors.forEach(error => console.error(`- ${error}`));
        return;
      }
      
      if (validation.warnings.length > 0) {
        console.log('Warnings:');
        validation.warnings.forEach(warning => console.log(`- ${warning}`));
      }
      
      // show preview
      const previewRows = parseInt(options.preview);
      console.log(`\nPreview (first ${previewRows} rows):`);
      const preview = await processor.getPreview(input, previewRows);
      console.log(JSON.stringify(preview.data, null, 2));
      
      // convert to JSON
      console.log('\nConverting to JSON...');
      const startTime = Date.now();
      
      let result: string;
      if (options.output) {
        result = await processor.convertToJSON(input, options.output);
        console.log(`JSON saved to: ${result}`);
      } else {
        result = await processor.convertToJSON(input);
        console.log('\nJSON output:');
        console.log(result);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`\nConversion completed in ${totalTime}ms`);
      
      // show stats
      const stats = await processor.getStatistics(input);
      console.log(`\nFile Statistics:`);
      console.log(`- Total rows: ${stats.totalRows}`);
      console.log(`- Total columns: ${stats.totalColumns}`);
      console.log(`- File size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

program
  .command('test-excel')
  .description('Test Excel processing with sample file')
  .argument('[file]', 'Excel file to test', './data/samples/xls/business-operations-survey-2023-CSV-notes.xlsx')
  .option('-s, --sheet <name>', 'Sheet name to process')
  .action(async (file, options) => {
    try {
      console.log(`Testing Excel file: ${file}`);
      
      const processor = new ExcelProcessor();
      
      // get sheet names
      const sheetNames = processor.getSheetNames(file);
      console.log(`\nAvailable sheets: ${sheetNames.join(', ')}`);
      
      // get stats
      const stats = await processor.getStatistics(file);
      console.log(`\nFile Statistics:`);
      console.log(`- Total sheets: ${stats.totalSheets}`);
      console.log(`- Total rows: ${stats.totalRows}`);
      console.log(`- Total cells: ${stats.totalCells}`);
      console.log(`- File size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
      
      // show sheet details
      console.log('\nSheet details:');
      stats.sheets.forEach(sheet => {
        console.log(`  - ${sheet.name}: ${sheet.rowCount} rows × ${sheet.columnCount} columns`);
      });
      
      // get preview
      const targetSheet = options.sheet || sheetNames[0];
      console.log(`\nPreview from sheet "${targetSheet}" (first 3 rows):`);
      const preview = await processor.getPreview(file, 3, targetSheet);
      console.log(JSON.stringify(preview.data, null, 2));
      
      // process full file
      console.log(`\nProcessing sheet "${targetSheet}"...`);
      const startTime = Date.now();
      const result = options.sheet ? 
        await processor.processSheet(file, options.sheet) :
        await processor.processFile(file);
      const totalTime = Date.now() - startTime;
      
      console.log(`Processing completed in ${totalTime}ms`);
      console.log(`Total rows processed: ${result.data.length}`);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

program
  .command('convert-excel')
  .description('Convert Excel file to JSON format')
  .argument('<input>', 'Input Excel file path')
  .option('-o, --output <path>', 'Output JSON file path (optional)')
  .option('-s, --sheet <name>', 'Sheet name to process (default: first sheet)')
  .option('-p, --preview <rows>', 'Show preview of first N rows', '5')
  .option('--all-sheets', 'Process all sheets')
  .action(async (input, options) => {
    try {
      console.log(`Converting Excel to JSON: ${input}`);
      
      const processor = new ExcelProcessor();
      
      // validate file first
      const validation = processor.validateExcel(input);
      if (!validation.isValid) {
        console.error('Validation errors:');
        validation.errors.forEach(error => console.error(`- ${error}`));
        return;
      }
      
      if (validation.warnings.length > 0) {
        console.log('Warnings:');
        validation.warnings.forEach(warning => console.log(`- ${warning}`));
      }
      
      // show available sheets
      const sheetNames = processor.getSheetNames(input);
      console.log(`\nAvailable sheets: ${sheetNames.join(', ')}`);
      
      if (options.allSheets) {
        console.log('\nProcessing all sheets...');
        const allResults = await processor.getAllSheets(input);
        
        for (const [sheetName, result] of Object.entries(allResults)) {
          console.log(`\nSheet: ${sheetName}`);
          console.log(`- Rows: ${result.data.length}`);
          console.log(`- Processing time: ${result.processingTime}ms`);
          
          // show preview
          const previewRows = parseInt(options.preview);
          console.log(`- Preview (first ${previewRows} rows):`);
          console.log(JSON.stringify(result.data.slice(0, previewRows), null, 2));
        }
        
        if (options.output) {
          const jsonString = JSON.stringify(allResults, null, 2);
          const fs = await import('fs');
          fs.writeFileSync(options.output, jsonString, 'utf8');
          console.log(`\nJSON saved to: ${options.output}`);
        }
        
      } else {
        // process single sheet
        const targetSheet = options.sheet || sheetNames[0];
        console.log(`\nProcessing sheet: ${targetSheet}`);
        
        // show preview
        const previewRows = parseInt(options.preview);
        console.log(`\nPreview (first ${previewRows} rows):`);
        const preview = await processor.getPreview(input, previewRows, targetSheet);
        console.log(JSON.stringify(preview.data, null, 2));
        
        // convert to JSON
        console.log('\nConverting to JSON...');
        const startTime = Date.now();
        
        let result: string;
        if (options.output) {
          result = await processor.convertToJSON(input, options.output);
          console.log(`JSON saved to: ${result}`);
        } else {
          result = await processor.convertToJSON(input);
          console.log('\nJSON output:');
          console.log(result);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`\nConversion completed in ${totalTime}ms`);
      }
      
      // show stats
      const stats = await processor.getStatistics(input);
      console.log(`\nFile Statistics:`);
      console.log(`- Total sheets: ${stats.totalSheets}`);
      console.log(`- Total rows: ${stats.totalRows}`);
      console.log(`- File size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

program.parse();
