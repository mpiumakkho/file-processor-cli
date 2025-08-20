import { CSVProcessor } from '../src/processors/csvProcessor';

describe('CSVProcessor', () => {
  let processor: CSVProcessor;

  beforeEach(() => {
    processor = new CSVProcessor();
  });

  describe('Constructor', () => {
    test('should create processor with default options', () => {
      expect(processor.getOptions()).toEqual({
        delimiter: ',',
        headers: true,
        skipEmptyLines: true,
        encoding: 'utf8'
      });
    });
  });
});