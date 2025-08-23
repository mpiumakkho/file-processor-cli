# File Processor CLI

A TypeScript CLI tool I built while learning Node.js and TypeScript fundamentals. Started as a simple learning project but evolved into something actually useful.

## Learning journey

This project helped me understand:
- **Node.js basics**: File system APIs, Buffer handling, npm ecosystem
- **TypeScript fundamentals**: Interfaces, classes, type safety
- **CLI development**: Command parsing, user interaction, error handling
- **Real-world patterns**: Testing, validation, modular architecture

## What it does

Processes different file formats and converts them to JSON. Supports:
- CSV files (various separators)
- Excel spreadsheets (multiple sheets)
- XML documents (with structure analysis)
- Auto file type detection

## Getting started

```bash
# Install dependencies
npm install

# Try the hello world example
npm run hello

# Test with sample data
npm run test-csv ./data/samples/csv/fish-monetary-stock-account-1996-2019.csv
```

## Learning progression

### Phase 1: TypeScript basics
Started with a simple hello world app (`src/hello-world/hello.ts`) to understand:
- TypeScript compilation
- Basic types and interfaces
- Node.js module system

### Phase 2: File operations
Built CSV processor first (`src/processors/csvProcessor.ts`):
- File system APIs (`fs.readFileSync`, `fs.writeFileSync`)
- Stream processing for large files
- Error handling patterns

### Phase 3: Advanced features
Added Excel and XML support:
- Third-party library integration (`xlsx`, `xml2js`)
- Complex data structures
- TypeScript interface design

### Phase 4: CLI interface
Created command-line interface (`src/cli/index.ts`):
- Commander.js for argument parsing
- User experience design
- Help documentation

## Commands I use most

```bash
# Quick file analysis
npm run detect path/to/file.csv

# Convert any file type
npm run process input.xlsx -o output.json

# Test specific formats
npm run test-csv data.csv
npm run test-excel spreadsheet.xlsx
npm run test-xml document.xml
```

## What I learned along the way

**TypeScript concepts:**
- Interface design for configuration objects
- Generic types for flexible APIs
- Union types for multiple file formats
- Class inheritance and composition

**Node.js patterns:**
- Async/await for file operations
- Error-first callbacks
- Module exports and imports
- Package.json script configuration

**Real-world development:**
- Testing strategies (Jest)
- Code organization (separate processors)
- Performance considerations
- User experience design

## Challenges faced

1. **Binary file handling**: Excel files needed special Buffer handling
2. **XML complexity**: Nested structures required recursive parsing  
3. **Type safety**: Balancing flexibility with TypeScript strictness
4. **Testing**: Mocking file systems and handling async operations

## Performance notes

- CSV: Handles ~170k rows/second
- File detection: <10ms response time
- Memory efficient for large files
- Concurrent processing support

## Development workflow

```bash
# Development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## Project structure

```
src/
├── processors/     # Core file processing logic
├── utils/         # Utility functions (file validation)
├── cli/           # Command-line interface
└── hello-world/   # Learning starter code

tests/             # Comprehensive test suite
data/samples/      # Test data files
```

## Next learning goals

- Stream processing for very large files
- Web interface using Express.js
- Database integration
- Docker containerization
- CI/CD pipeline setup

## Notes for other learners

If you're starting with Node.js/TypeScript:
1. Begin with the hello world example
2. Understand the file system APIs first
3. Learn TypeScript gradually (start with basic types)
4. Test early and often
5. Read other people's code for patterns

The progression from simple file reading to complex processing really helped solidify the concepts.

## License

MIT - built for learning, use however helps your learning journey.