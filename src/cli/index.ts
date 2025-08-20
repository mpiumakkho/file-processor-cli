#!/usr/bin/env node

import { Command } from 'commander';
import CSVProcessor from '../processors/csvProcessor';

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

program.parse();
