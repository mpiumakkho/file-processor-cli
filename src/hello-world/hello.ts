#!/usr/bin/env node

/**
 * Hello World function for file-processor-cli
 * Purpose: Test TypeScript and Node.js setup
 */

interface WelcomeMessage {
  message: string;
  timestamp: Date;
  projectName: string;
  author: string;
}

class HelloWorld {
  private projectName: string;
  private author: string;

  constructor(projectName: string = 'file-processor-cli', author: string = 'Marut') {
    this.projectName = projectName;
    this.author = author;
  }

  public generateWelcomeMessage(): WelcomeMessage {
    return {
      message: `Hello! Welcome to ${this.projectName}`,
      timestamp: new Date(),
      projectName: this.projectName,
      author: this.author
    };
  }

  public displayWelcome(): void {
    const welcome = this.generateWelcomeMessage();
    
    console.log('='.repeat(50));
    console.log(`Project: ${welcome.message}`);
    console.log(`Time: ${welcome.timestamp.toISOString()}`);
    console.log(`Author: ${welcome.author}`);
    console.log('='.repeat(50));
    console.log('TypeScript and Node.js are working!');
    console.log('Ready to build CLI tool for file processing');
    console.log('='.repeat(50));
  }

  public getProjectInfo(): { name: string; author: string } {
    return {
      name: this.projectName,
      author: this.author
    };
  }
}

// Export for testing
export { HelloWorld, WelcomeMessage };

// Run if called directly
if (require.main === module) {
  const hello = new HelloWorld();
  hello.displayWelcome();
}