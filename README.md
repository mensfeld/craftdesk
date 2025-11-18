# CraftDesk CLI

> **Dependency management for AI capabilities** - Install, manage, and version control your Claude Code skills, agents, commands, and hooks.

The official command-line interface for managing CraftDesk AI capabilities. Similar to npm for JavaScript or bundler for Ruby, CraftDesk CLI provides a complete package management solution for AI-powered development tools.

[![npm version](https://img.shields.io/npm/v/craftdesk-cli.svg)](https://www.npmjs.com/package/craftdesk-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table of Contents

- [What is CraftDesk?](#what-is-craftdesk)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Command Reference](#command-reference)
- [Dependency Sources](#dependency-sources)
- [Multi-Registry Setup](#multi-registry-setup)
- [Monorepo Support](#monorepo-support)
- [craftdesk.json Reference](#craftdeskjson-reference)
- [craftdesk.lock](#craftdesklock)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## What is CraftDesk?

CraftDesk is a package manager for AI capabilities used in Claude Code and other AI development environments. It allows you to:

- 📦 **Install AI skills, agents, commands, and hooks** from registries or git
- 🔒 **Lock versions** for reproducible environments across teams
- 🌳 **Manage dependencies** with automatic transitive resolution
- 🔐 **Use private registries** for company-internal capabilities
- 📁 **Support monorepos** with subdirectory extraction
- 🔄 **Mix sources** - combine registry packages with git dependencies

Think of it as:
- **npm** for Node.js packages → **CraftDesk** for AI capabilities
- **Bundler** for Ruby gems → **CraftDesk** for Claude tools
- **Cargo** for Rust crates → **CraftDesk** for AI agents

---

## Installation

### Global Installation

```bash
npm install -g craftdesk-cli
```

Verify installation:
```bash
craftdesk --version
# 0.1.0
```

### Local Development Setup

Clone and link for development:

```bash
git clone https://github.com/your-org/craftdesk-cli.git
cd craftdesk-cli
npm install
npm link
craftdesk --version
```

### Requirements

- Node.js >= 16.0.0
- Git (for git dependencies)
- npm or yarn

---

## Quick Start

### 1. Initialize a New Project

```bash
mkdir my-ai-project
cd my-ai-project
craftdesk init
```

This creates a `craftdesk.json` file:
```json
{
  "name": "my-ai-project",
  "version": "1.0.0",
  "type": "skill",
  "dependencies": {}
}
```

### 2. Add Dependencies

```bash
# Add from public registry
craftdesk add ruby-on-rails

# Add from git
craftdesk add git+https://github.com/user/custom-agent.git

# Add from private registry
craftdesk add @company/internal-skill
```

### 3. Install Everything

```bash
craftdesk install
```

This installs all dependencies to `.claude/` directory and creates `craftdesk.lock`.

### 4. View Installed Crafts

```bash
craftdesk list
# my-ai-project@1.0.0
#
# Installed crafts:
#   📚 ruby-on-rails@7.1.2 (skill)
#   🤖 custom-agent@main (agent)
#   📚 @company/internal-skill@2.0.0 (skill)
```

---

## Core Concepts

### Crafts

A **craft** is any AI capability:
- **Skill** 📚 - Knowledge domain (e.g., ruby-on-rails, postgres-expert)
- **Agent** 🤖 - Autonomous task executor (e.g., code-reviewer, test-runner)
- **Command** ⚡ - Slash command (e.g., /deploy, /analyze)
- **Hook** 🔗 - Event handler (e.g., pre-commit, post-install)

### Manifest File: craftdesk.json

Declares your project's dependencies:
```json
{
  "name": "my-project",
  "version": "1.0.0",
  "dependencies": {
    "ruby-on-rails": "^7.0.0",
    "postgres-expert": "~1.2.0"
  }
}
```

### Lockfile: craftdesk.lock

Records exact versions installed (like package-lock.json or Gemfile.lock):
```json
{
  "version": "1.0.0",
  "crafts": {
    "ruby-on-rails": {
      "version": "7.1.2",
      "resolved": "https://craftdesk.ai/api/v1/crafts/...",
      "integrity": "sha256-abc123..."
    }
  }
}
```

**Always commit this file to version control!**

### Install Directory

By default, crafts install to `.claude/` in your project:
```
.claude/
├── skills/
│   ├── ruby-on-rails/
│   └── postgres-expert/
├── agents/
│   └── code-reviewer/
├── commands/
│   └── deploy/
└── hooks/
    └── pre-commit/
```

---

## Command Reference

### `craftdesk init [options]`

Initialize a new craftdesk.json file.

**Options:**
- `-y, --yes` - Skip prompts and use defaults
- `-n, --name <name>` - Project name (default: directory name)
- `-v, --version <version>` - Project version (default: "1.0.0")
- `-t, --type <type>` - Project type: skill, agent, command, or hook (default: "skill")
- `-d, --description <desc>` - Project description
- `-a, --author <author>` - Author name
- `-l, --license <license>` - License (default: "MIT")

**Examples:**
```bash
# Interactive initialization
craftdesk init

# Quick init with defaults
craftdesk init -y

# Specify options
craftdesk init --name my-skill --type skill --author "Your Name"
```

---

### `craftdesk install [options]`

Install all dependencies from craftdesk.json.

**Options:**
- `--no-lockfile` - Ignore craftdesk.lock and re-resolve dependencies
- `--production` - Skip devDependencies

**Examples:**
```bash
# Install all dependencies
craftdesk install

# Or use the alias
craftdesk i

# Production install (skip dev dependencies)
craftdesk install --production

# Force re-resolve (ignore lockfile)
craftdesk install --no-lockfile
```

**What it does:**
1. Reads craftdesk.json
2. Uses craftdesk.lock if present (ensures reproducibility)
3. Resolves dependencies (registry + git sources)
4. Installs to .claude/ directory
5. Updates/creates craftdesk.lock

---

### `craftdesk add <package> [options]`

Add a new dependency and install it immediately.

**Options:**
- `-D, --save-dev` - Save as devDependency
- `-O, --save-optional` - Save as optionalDependency
- `-E, --save-exact` - Save exact version (no ^ or ~)

**Examples:**

```bash
# Add from registry
craftdesk add ruby-on-rails
craftdesk add ruby-on-rails@^7.0.0
craftdesk add @company/private-skill
craftdesk add @company/private-skill@2.1.0

# Add as dev dependency
craftdesk add code-reviewer -D

# Add exact version
craftdesk add postgres-expert@1.2.3 -E

# Git dependencies
craftdesk add git+https://github.com/user/repo.git
craftdesk add git+https://github.com/user/repo.git#develop
craftdesk add git+https://github.com/user/repo.git#v2.0.0

# Git with subdirectory (monorepo)
craftdesk add git+https://github.com/company/monorepo.git#main#path:skills/auth
```

---

### `craftdesk remove <package>`

Remove a dependency from craftdesk.json and the filesystem.

**Examples:**
```bash
craftdesk remove ruby-on-rails
craftdesk remove @company/internal-skill
```

---

### `craftdesk list [options]`

List installed crafts.

**Options:**
- `--tree` - Show dependency tree
- `--depth <n>` - Limit tree depth
- `--json` - Output as JSON

**Examples:**
```bash
# Simple list
craftdesk list

# Show dependency tree
craftdesk list --tree

# Limit tree depth
craftdesk list --tree --depth 2

# JSON output (for scripts)
craftdesk list --json
```

**Example output:**
```
my-project@1.0.0

Installed crafts:
  📚 ruby-on-rails@7.1.2 (skill)
  🤖 code-reviewer@2.0.1 (agent)
  📚 postgres-expert@1.2.3 (skill)

Total: 3 crafts installed
```

---

### Global Options

Available for all commands:

- `-v, --version` - Output the version number
- `-d, --debug` - Enable debug output
- `-h, --help` - Display help

**Examples:**
```bash
craftdesk --version
craftdesk --help
craftdesk init --help
```

---

## Dependency Sources

CraftDesk supports multiple dependency sources:

### 1. Registry Dependencies (Default)

From the public or private CraftDesk registries:

```json
{
  "dependencies": {
    "ruby-on-rails": "^7.0.0",
    "postgres-expert": "~1.2.0",
    "@company/internal-skill": "^2.0.0"
  }
}
```

**Version constraints:**
- `^1.2.3` - Compatible with 1.x.x (>=1.2.3, <2.0.0)
- `~1.2.3` - Approximately equivalent (>=1.2.3, <1.3.0)
- `1.2.3` - Exact version
- `>=1.2.3` - Greater than or equal to
- `*` or `latest` - Any version

### 2. Git Dependencies

From git repositories:

```json
{
  "dependencies": {
    "custom-agent": {
      "git": "https://github.com/user/agent-repo.git",
      "branch": "develop"
    },
    "stable-skill": {
      "git": "https://github.com/org/skills.git",
      "tag": "v2.1.0"
    },
    "specific-commit": {
      "git": "https://github.com/user/repo.git",
      "commit": "a1b2c3d4"
    }
  }
}
```

**Git options:**
- `git` - Repository URL (required)
- `branch` - Branch name (default: main/master)
- `tag` - Git tag
- `commit` - Specific commit hash
- `path` - Subdirectory within repo (for monorepos)

### 3. Registry with Custom URL

Specify a different registry per dependency:

```json
{
  "dependencies": {
    "special-tool": {
      "version": "^2.0.0",
      "registry": "https://tools.example.com"
    }
  }
}
```

---

## Multi-Registry Setup

Configure multiple registries in your craftdesk.json:

```json
{
  "name": "enterprise-project",
  "version": "1.0.0",

  "dependencies": {
    "ruby-on-rails": "^7.0.0",
    "@company/private-skill": {
      "version": "^3.0.0",
      "registry": "company-private"
    },
    "special-tool": {
      "version": "^2.0.0",
      "registry": "https://tools.example.com"
    }
  },

  "registries": {
    "default": {
      "url": "https://craftdesk.ai"
    },
    "company-private": {
      "url": "https://registry.company.com",
      "scope": "@company"
    }
  }
}
```

### Authentication

Use environment variables for authentication:

```bash
# Set auth token for a named registry
export CRAFTDESK_AUTH_COMPANY_PRIVATE=your-token-here

# Install with authentication
craftdesk install
```

**Token naming pattern:**
- Registry name: `company-private`
- Environment variable: `CRAFTDESK_AUTH_COMPANY_PRIVATE`
- Convert to uppercase, replace hyphens with underscores

---

## Monorepo Support

Install multiple crafts from the same git repository using subdirectory paths:

```json
{
  "dependencies": {
    "auth-handler": {
      "git": "https://github.com/company/ai-crafts-monorepo.git",
      "tag": "v3.2.0",
      "path": "skills/auth"
    },
    "data-processor": {
      "git": "https://github.com/company/ai-crafts-monorepo.git",
      "tag": "v3.2.0",
      "path": "agents/processor"
    },
    "report-generator": {
      "git": "https://github.com/company/ai-crafts-monorepo.git",
      "tag": "v3.2.0",
      "path": "skills/reporting"
    }
  }
}
```

**Benefits:**
- Single git repository for multiple crafts
- Version them together with git tags
- Each craft installs independently
- Efficient cloning (repo cached during resolution)

**Monorepo structure example:**
```
ai-crafts-monorepo/
├── skills/
│   ├── auth/
│   │   ├── craftdesk.json
│   │   └── SKILL.md
│   └── reporting/
│       ├── craftdesk.json
│       └── SKILL.md
├── agents/
│   └── processor/
│       ├── craftdesk.json
│       └── AGENT.md
└── commands/
    └── deploy/
        ├── craftdesk.json
        └── COMMAND.md
```

---

## craftdesk.json Reference

Complete specification of the craftdesk.json format:

```json
{
  // Required fields
  "name": "my-project",
  "version": "1.0.0",

  // Optional metadata
  "type": "skill",
  "description": "My awesome AI project",
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "homepage": "https://example.com",
  "repository": {
    "type": "git",
    "url": "https://github.com/user/repo.git"
  },
  "keywords": ["ai", "claude", "automation"],

  // Dependencies
  "dependencies": {
    "simple-package": "^1.0.0",
    "complex-package": {
      "version": "^2.0.0",
      "registry": "company-private"
    },
    "git-package": {
      "git": "https://github.com/user/repo.git",
      "branch": "main",
      "path": "packages/skill"
    }
  },

  "devDependencies": {
    "test-runner": "^1.0.0"
  },

  "optionalDependencies": {
    "experimental-feature": "^0.1.0"
  },

  // Registry configuration
  "registries": {
    "default": {
      "url": "https://craftdesk.ai"
    },
    "company-private": {
      "url": "https://registry.company.com",
      "scope": "@company"
    }
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Package name (lowercase, no spaces) |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `type` | string | No | Craft type: skill, agent, command, hook |
| `description` | string | No | Short description |
| `author` | string | No | Author name and email |
| `license` | string | No | License identifier (e.g., "MIT") |
| `dependencies` | object | No | Production dependencies |
| `devDependencies` | object | No | Development dependencies |
| `optionalDependencies` | object | No | Optional dependencies |
| `registries` | object | No | Registry configuration |

---

## craftdesk.lock

The lockfile ensures reproducible installations across different machines and times.

### What's in the Lockfile?

```json
{
  "version": "1.0.0",
  "lockfileVersion": 1,
  "crafts": {
    "ruby-on-rails": {
      "version": "7.1.2",
      "resolved": "https://craftdesk.ai/api/v1/crafts/.../download",
      "integrity": "sha256-abc123...",
      "type": "skill",
      "author": "anthropic",
      "registry": "https://craftdesk.ai",
      "dependencies": {
        "activerecord": "^7.1.0"
      }
    },
    "custom-agent": {
      "version": "2.0.0",
      "resolved": "https://github.com/user/agent.git",
      "integrity": "a1b2c3d4e5f6...",
      "type": "agent",
      "git": "https://github.com/user/agent.git",
      "branch": "main",
      "commit": "a1b2c3d4e5f6789012345678901234567890abcd",
      "dependencies": {}
    }
  },
  "tree": {
    "ruby-on-rails@7.1.2": {
      "dependencies": {
        "activerecord@7.1.0": {}
      }
    }
  }
}
```

### Best Practices

✅ **DO:**
- Commit craftdesk.lock to version control
- Let the CLI manage it (don't edit manually)
- Use it for reproducible builds in CI/CD

❌ **DON'T:**
- Ignore craftdesk.lock in .gitignore
- Edit it manually
- Delete it without `--no-lockfile` flag

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install CraftDesk CLI
        run: npm install -g craftdesk-cli

      - name: Install AI capabilities
        env:
          CRAFTDESK_AUTH_COMPANY: ${{ secrets.CRAFTDESK_TOKEN }}
        run: craftdesk install --production

      - name: Deploy
        run: ./deploy.sh
```

### GitLab CI

```yaml
deploy:
  image: node:18
  script:
    - npm install -g craftdesk-cli
    - export CRAFTDESK_AUTH_COMPANY=$CRAFTDESK_TOKEN
    - craftdesk install --production
    - ./deploy.sh
  only:
    - main
```

### Docker

```dockerfile
FROM node:18

# Install CraftDesk CLI
RUN npm install -g craftdesk-cli

# Copy project files
WORKDIR /app
COPY craftdesk.json craftdesk.lock ./

# Install AI capabilities
ARG CRAFTDESK_AUTH_COMPANY
ENV CRAFTDESK_AUTH_COMPANY=$CRAFTDESK_AUTH_COMPANY
RUN craftdesk install --production

# Copy rest of application
COPY . .

CMD ["node", "app.js"]
```

---

## Troubleshooting

### Common Issues

#### `No craftdesk.json found`

Make sure you're in a directory with a craftdesk.json file, or run `craftdesk init` first.

#### `Failed to resolve dependencies`

- Check internet connection
- Verify registry URLs are accessible
- For private registries, ensure auth tokens are set
- Try `craftdesk install --no-lockfile` to re-resolve

#### `Git clone failed`

- Verify git is installed: `git --version`
- Check git repository URL is accessible
- For private repos, ensure SSH keys or tokens are configured

#### `Permission denied`

- For global install: `sudo npm install -g craftdesk-cli`
- Or use npx: `npx craftdesk-cli install`

#### `Dependency conflicts`

Currently uses last-write-wins. Future versions will have interactive conflict resolution.

### Debug Mode

Enable verbose logging:

```bash
craftdesk --debug install
```

### Getting Help

```bash
# General help
craftdesk --help

# Command-specific help
craftdesk init --help
craftdesk add --help
craftdesk install --help
```

---

## Development

### Building from Source

```bash
git clone https://github.com/your-org/craftdesk-cli.git
cd craftdesk-cli
npm install
npm run build
npm link
```

### Project Structure

```
craftdesk-cli/
├── src/
│   ├── commands/       # CLI commands
│   ├── services/       # Core services
│   ├── types/          # TypeScript types
│   └── utils/          # Utilities
├── dist/               # Compiled JavaScript
├── bin/                # Executable entry point
├── examples/           # Example craftdesk.json files
└── docs/               # Documentation
```

### Running Tests

```bash
npm test
```

### Publishing

```bash
npm version patch
npm publish
```

---

## License

MIT

---

## Links

- **Documentation**: [https://craftdesk.ai/docs](https://craftdesk.ai/docs)
- **Registry**: [https://craftdesk.ai](https://craftdesk.ai)
- **Issues**: [https://github.com/your-org/craftdesk-cli/issues](https://github.com/your-org/craftdesk-cli/issues)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

---

Made with ❤️ for the AI development community