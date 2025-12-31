# Contributing to YourGPT Copilot SDK

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 9.0.0+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yourgpt/copilot-sdk.git
cd copilot-sdk

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development mode
pnpm dev
```

### Project Structure

```
yourgpt-copilot/
├── packages/
│   ├── core/          # @yourgpt/copilot-sdk-core - Types & utilities
│   ├── react/         # @yourgpt/copilot-sdk-react - React hooks
│   ├── ui/            # @yourgpt/copilot-sdk-ui - UI components
│   ├── runtime/       # @yourgpt/llm-sdk - Multi-provider LLM integration
│   └── knowledge/     # @yourgpt/copilot-sdk-knowledge - KB integration (Coming Soon)
├── apps/
│   └── docs/          # Documentation site
├── examples/          # Example applications
└── ...
```

### Development Commands

```bash
# Build all packages
pnpm build

# Build specific packages
pnpm build --filter=@yourgpt/copilot-sdk-react

# Development mode (watches for changes)
pnpm dev

# Run linting
pnpm lint

# Format code
pnpm format

# Type check
pnpm typecheck
```

## Making Changes

### Branching

1. Create a branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add new feature"
   ```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Creating a Changeset

For changes that should be published:

```bash
pnpm changeset
```

This will prompt you to:

1. Select which packages changed
2. Choose the bump type (major/minor/patch)
3. Write a summary of the changes

### Pull Requests

1. Push your branch
2. Open a PR against `main`
3. Fill out the PR template
4. Wait for review

## Code Guidelines

### TypeScript

- Use strict TypeScript
- Export types from package index
- Prefer interfaces over types for public APIs

### React

- Use functional components
- Prefer hooks over HOCs
- Memoize expensive computations

### Testing

- Write tests for new features
- Ensure existing tests pass
- Test edge cases

## Package Development

### Adding a New Package

1. Create directory in `packages/`
2. Add `package.json` with proper config
3. Add `tsup.config.ts` for building
4. Update root `pnpm-workspace.yaml` if needed

### Publishing (Maintainers)

```bash
# Create version bump
pnpm version-packages

# Build and publish
pnpm release
```

## Getting Help

- Open an issue for bugs
- Start a discussion for questions
- Check existing issues before creating new ones

## Code of Conduct

Be respectful and constructive. We're all here to build something great together.
