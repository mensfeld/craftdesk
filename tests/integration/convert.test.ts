import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { ConverterService } from '../../src/services/converter';
import type { ConversionOptions } from '../../src/types/converter';

const TEST_DIR = path.join(__dirname, '../fixtures/converter-test');
const OUTPUT_DIR = path.join(TEST_DIR, 'output');

describe('Format Conversion Integration Tests', () => {
  let converterService: ConverterService;

  beforeEach(async () => {
    converterService = new ConverterService();
    await fs.ensureDir(TEST_DIR);
    await fs.ensureDir(OUTPUT_DIR);
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  describe('Cursor Format Conversion', () => {
    it('should convert a skill to Cursor .mdc format', async () => {
      // Create mock skill
      const skillDir = path.join(TEST_DIR, 'ruby-skill');
      await fs.ensureDir(skillDir);

      const craftJson = {
        name: 'ruby-on-rails',
        version: '1.0.0',
        type: 'skill',
        description: 'Provides Ruby on Rails development knowledge'
      };

      const skillMd = `---
name: ruby-on-rails
description: Ruby on Rails development knowledge
---

# Ruby on Rails Development

## Instructions

This skill provides knowledge about Ruby on Rails web framework development.

## Common Patterns

### Active Record Pattern

\`\`\`ruby
class User < ApplicationRecord
  has_many :posts
  validates :email, presence: true
end
\`\`\`

## Quick Reference

### Creating a Controller

\`\`\`ruby
class PostsController < ApplicationController
  def index
    @posts = Post.all
  end
end
\`\`\`

### Creating a Model

\`\`\`ruby
class Post < ApplicationRecord
  belongs_to :user
  validates :title, presence: true
end
\`\`\`

## Best Practices

- **Use Strong Parameters**: Always use strong parameters to prevent mass assignment vulnerabilities
- **Follow RESTful Conventions**: Stick to RESTful routing conventions
- **Write Tests**: Use RSpec for testing

## Common Pitfalls

❌ **Using instance variables in views directly**
✓ **Instead**: Pass data through controller actions

❌ **N+1 queries in views**
✓ **Instead**: Use includes/eager loading

## Common Workflows

### Creating a new Rails resource

1. Generate the model: \`rails g model Post title:string\`
2. Run migrations: \`rails db:migrate\`
3. Create controller: \`rails g controller Posts\`
4. Add routes in config/routes.rb
`;

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), craftJson);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMd);

      // Convert to Cursor format
      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR
      };

      const result = await converterService.convertAndWrite(skillDir, options, OUTPUT_DIR);

      // Verify conversion
      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);

      // Check .mdc file was created
      const mdcPath = path.join(OUTPUT_DIR, 'ruby-on-rails.mdc');
      expect(await fs.pathExists(mdcPath)).toBe(true);

      const content = await fs.readFile(mdcPath, 'utf-8');

      // Verify frontmatter
      expect(content).toContain('---');
      expect(content).toContain('description:');
      expect(content).toContain('globs:');
      expect(content).toContain('alwaysApply:');

      // Verify content sections
      expect(content).toContain('# Ruby On Rails');
      expect(content).toContain('## Overview');
      expect(content).toContain('## Code Patterns');
      expect(content).toContain('## Best Practices');
      expect(content).toContain('## Common Mistakes to Avoid');

      // Verify code examples are preserved
      expect(content).toContain('class User < ApplicationRecord');
      expect(content).toContain('has_many :posts');
    });

    it('should convert to legacy .cursorrules format', async () => {
      // Create mock skill
      const skillDir = path.join(TEST_DIR, 'python-skill');
      await fs.ensureDir(skillDir);

      const craftJson = {
        name: 'python-basics',
        version: '1.0.0',
        type: 'skill',
        description: 'Python programming basics'
      };

      const skillMd = `---
name: python-basics
description: Python programming basics
---

# Python Basics

## Instructions

This skill provides knowledge about Python programming.

## Quick Reference

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`
`;

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), craftJson);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMd);

      // Convert to legacy format
      const options: ConversionOptions = {
        format: 'cursor-legacy',
        outputDir: OUTPUT_DIR
      };

      const result = await converterService.convertAndWrite(skillDir, options, OUTPUT_DIR);

      expect(result.success).toBe(true);

      const rulesPath = path.join(OUTPUT_DIR, '.cursorrules');
      expect(await fs.pathExists(rulesPath)).toBe(true);

      const content = await fs.readFile(rulesPath, 'utf-8');
      expect(content).toContain('# Python Basics');
      expect(content).toContain('def hello_world()');
    });

    it('should infer correct globs for different languages', async () => {
      const skillDir = path.join(TEST_DIR, 'typescript-skill');
      await fs.ensureDir(skillDir);

      const craftJson = {
        name: 'typescript-expert',
        version: '1.0.0',
        type: 'skill',
        description: 'TypeScript development expertise'
      };

      const skillMd = `---
name: typescript-expert
description: TypeScript development expertise
---

# TypeScript Expert

## Instructions

Expert knowledge of TypeScript programming.
`;

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), craftJson);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMd);

      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR
      };

      const result = await converterService.convertAndWrite(skillDir, options, OUTPUT_DIR);

      expect(result.success).toBe(true);

      const mdcPath = path.join(OUTPUT_DIR, 'typescript-expert.mdc');
      const content = await fs.readFile(mdcPath, 'utf-8');

      // Should infer TypeScript globs
      expect(content).toMatch(/\*\*\/\*\.ts/);
      expect(content).toMatch(/\*\*\/\*\.tsx/);
    });
  });

  describe('Continue Format Conversion', () => {
    it('should convert a skill to Continue prompt format', async () => {
      const skillDir = path.join(TEST_DIR, 'react-skill');
      await fs.ensureDir(skillDir);

      const craftJson = {
        name: 'react-hooks',
        version: '1.0.0',
        type: 'skill',
        description: 'React Hooks development patterns'
      };

      const skillMd = `---
name: react-hooks
description: React Hooks development patterns
---

# React Hooks

## Instructions

This skill provides knowledge about React Hooks.

## Quick Start Template

\`\`\`jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
\`\`\`

## Common Workflows

### Using useState

1. Import useState from 'react'
2. Declare state variable
3. Use setter function to update

## Best Practices

- **Don't call Hooks inside loops**: Hooks must be called at top level
- **Use custom Hooks**: Extract reusable logic into custom Hooks

## Common Pitfalls

❌ **Calling Hooks conditionally**
✓ **Instead**: Always call Hooks in the same order
`;

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), craftJson);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMd);

      const options: ConversionOptions = {
        format: 'continue',
        outputDir: OUTPUT_DIR
      };

      const result = await converterService.convertAndWrite(skillDir, options, OUTPUT_DIR);

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(2); // prompt + rule

      // Check prompt file
      const promptPath = path.join(OUTPUT_DIR, 'react-hooks.md');
      expect(await fs.pathExists(promptPath)).toBe(true);

      const promptContent = await fs.readFile(promptPath, 'utf-8');

      // Verify frontmatter
      expect(promptContent).toContain('---');
      expect(promptContent).toContain('name: reactHooks');
      expect(promptContent).toContain('invokable: true');

      // Verify template variables
      expect(promptContent).toContain('{{{ input }}}');
      expect(promptContent).toContain('{{{ currentFile }}}');

      // Verify sections
      expect(promptContent).toContain('## Context');
      expect(promptContent).toContain('## Your Task');
      expect(promptContent).toContain('## Quick Start Template');
      expect(promptContent).toContain('## Step-by-Step Workflows');

      // Check rule file
      const rulePath = path.join(OUTPUT_DIR, 'react-hooks-rules.md');
      expect(await fs.pathExists(rulePath)).toBe(true);

      const ruleContent = await fs.readFile(rulePath, 'utf-8');
      expect(ruleContent).toContain('## Best Practices');
      expect(ruleContent).toContain('## Avoid These Mistakes');
    });
  });

  describe('Batch Conversion', () => {
    it('should convert all installed crafts', async () => {
      // Create mock .claude directory structure
      const claudeDir = path.join(TEST_DIR, '.claude');
      const skillsDir = path.join(claudeDir, 'skills');
      await fs.ensureDir(skillsDir);

      // Create multiple skills
      const skills = [
        { name: 'ruby-rails', description: 'Ruby on Rails' },
        { name: 'python-django', description: 'Python Django' },
        { name: 'node-express', description: 'Node.js Express' }
      ];

      for (const skill of skills) {
        const skillDir = path.join(skillsDir, skill.name);
        await fs.ensureDir(skillDir);

        await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), {
          name: skill.name,
          version: '1.0.0',
          type: 'skill',
          description: skill.description
        });

        await fs.writeFile(path.join(skillDir, 'SKILL.md'), `# ${skill.name}\n\n${skill.description}`);
      }

      // Convert all
      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR
      };

      const results = await converterService.convertAllInstalled(claudeDir, options, OUTPUT_DIR);

      expect(results.length).toBe(3);
      expect(results.every(r => r.result.success)).toBe(true);

      // Verify all files created
      for (const skill of skills) {
        const mdcPath = path.join(OUTPUT_DIR, `${skill.name}.mdc`);
        expect(await fs.pathExists(mdcPath)).toBe(true);
      }
    });
  });

  describe('Merge Modes', () => {
    it('should overwrite existing files by default', async () => {
      const skillDir = path.join(TEST_DIR, 'test-skill');
      await fs.ensureDir(skillDir);

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        type: 'skill'
      });

      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test\n\n## Instructions\n\nTest content');

      // Create existing file
      const targetPath = path.join(OUTPUT_DIR, 'test.mdc');
      await fs.writeFile(targetPath, 'Old content');

      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR,
        mergeMode: 'overwrite'
      };

      await converterService.convertAndWrite(skillDir, options, OUTPUT_DIR);

      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).not.toContain('Old content');
      expect(content).toContain('# Test');
      expect(content).toContain('Test content');
    });

    it('should skip existing files when merge mode is skip', async () => {
      const skillDir = path.join(TEST_DIR, 'test-skill');
      await fs.ensureDir(skillDir);

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        type: 'skill'
      });

      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

      // Create existing file
      const targetPath = path.join(OUTPUT_DIR, 'test.mdc');
      await fs.writeFile(targetPath, 'Old content');

      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR,
        mergeMode: 'skip'
      };

      const result = await converterService.convertAndWrite(skillDir, options, OUTPUT_DIR);

      expect(result.warnings).toContain('Skipped existing file: test.mdc');

      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).toBe('Old content');
    });
  });

  describe('Error Handling', () => {
    it('should fail gracefully when craftdesk.json is missing', async () => {
      const skillDir = path.join(TEST_DIR, 'invalid-skill');
      await fs.ensureDir(skillDir);

      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR
      };

      await expect(
        converterService.convertFromDirectory(skillDir, options)
      ).rejects.toThrow('No craftdesk.json found');
    });

    it('should fail gracefully when marker file is missing', async () => {
      const skillDir = path.join(TEST_DIR, 'invalid-skill');
      await fs.ensureDir(skillDir);

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        type: 'skill'
      });

      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR
      };

      await expect(
        converterService.convertFromDirectory(skillDir, options)
      ).rejects.toThrow('No marker file');
    });

    it('should report unsupported craft types', async () => {
      const skillDir = path.join(TEST_DIR, 'plugin-craft');
      await fs.ensureDir(skillDir);

      await fs.writeJSON(path.join(skillDir, 'craftdesk.json'), {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'plugin'
      });

      await fs.writeFile(path.join(skillDir, 'PLUGIN.md'), '# Plugin');

      const options: ConversionOptions = {
        format: 'cursor',
        outputDir: OUTPUT_DIR
      };

      const result = await converterService.convertFromDirectory(skillDir, options);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not supported');
    });
  });
});
