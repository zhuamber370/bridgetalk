# Contributing to BridgeTalk

Thank you for your interest in contributing!

## Code of Conduct

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) before contributing.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [Issues](https://github.com/zhuamber370/bridgetalk/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Environment info (OS, browser, Node version)

### Suggesting Features

1. Open a new issue with the `enhancement` label
2. Describe the feature and its use case
3. Provide examples or mockups if possible

### Submitting Pull Requests

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Make your changes**
   - Follow the coding style (see below)
   - Add tests if applicable
   - Update documentation
4. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add task filtering by status"
   git commit -m "fix: resolve message duplication bug"
   ```
5. **Push and create PR**
   ```bash
   git push origin feat/your-feature-name
   ```
   Then open a PR on GitHub with:
   - Clear title (following conventional commits)
   - Description of changes
   - Related issue number (if any)

## Development Setup

```bash
# Install dependencies
pnpm install

# Start dev servers
pnpm dev

# Build for production
pnpm build
```

## Coding Standards

### TypeScript
- Use strict mode
- Prefer `interface` over `type` for object shapes
- Add JSDoc comments for public APIs

### React
- Use functional components with hooks
- Keep components small and focused
- Use TypeScript props interfaces

### Styling
- Use Tailwind CSS utility classes
- Follow the black & white color scheme
- Use CSS variables from `styles/index.css`

### Commits
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Build/tooling

## Review Process

1. Automated checks must pass (TypeScript, ESLint, tests)
2. Maintainer reviews code
3. Address feedback if any
4. Maintainer merges PR

## Questions?

Feel free to ask in [Discussions](https://github.com/zhuamber370/bridgetalk/discussions) or open an issue.
