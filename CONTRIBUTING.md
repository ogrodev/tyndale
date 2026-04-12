# Contributing to Tyndale

## Reporting Bugs

Open an issue at https://github.com/ogrodev/tyndale/issues. Include:

- Tyndale version and package (`tyndale`, `tyndale-react`, or `tyndale-next`)
- Node/Bun version
- Minimal reproduction case
- Expected vs actual behavior

## Suggesting Features

Open an issue with the `enhancement` label. Describe the use case, not just the solution. Check existing issues first.

## Development Setup

Prerequisites: [Bun](https://bun.sh) >= 1.0

```sh
git clone https://github.com/ogrodev/tyndale.git
cd tyndale
bun install
```

Run tests:

```sh
bun test
```

Type check:

```sh
bun run typecheck
```

## Monorepo Structure

```
packages/
  tyndale/          # CLI — translation extraction, config management
  tyndale-react/    # React hooks and components
  tyndale-next/     # Next.js adapter and middleware
```

Each package is independently versioned. Changes scoped to one package should only touch that package unless there is a cross-cutting concern.

## Pull Request Process

1. Fork the repository and create a branch from `main`.
2. Name branches descriptively: `fix/missing-locale-fallback`, `feat/pluralization-support`.
3. Make your changes. Add or update tests to cover the change.
4. Run `bun test` and `bun run typecheck` — both must pass.
5. Open a PR against `main`. Fill in the PR template.
6. A maintainer will review. Address feedback in new commits; do not force-push during review.

PRs that add features without tests, break type safety, or skip the checklist will not be merged.

## Code Style

- TypeScript throughout. No `any` unless unavoidable and justified in a comment.
- No build step required for development — packages are consumed as TypeScript source in tests.
- Run `bun run typecheck` before submitting. Type errors block merge.
- Prefer explicit over clever. The next reader should not need to reverse-engineer intent.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add pluralization support to useTranslation
fix: resolve locale fallback when default locale is missing
chore: update bun lockfile
docs: document tyndale-next middleware options
test: add edge cases for nested key resolution
```

Scope is optional but useful for monorepo clarity:

```
feat(tyndale-react): add useLocale hook
fix(tyndale): handle missing config file gracefully
```

Breaking changes must include `BREAKING CHANGE:` in the commit footer.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
