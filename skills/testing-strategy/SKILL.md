---
name: testing-strategy
description: Provides testing strategy guidance including test pyramid, coverage targets, test patterns, and stack-specific test tooling. Triggers on testing, test strategy, test coverage, unit test, integration test, e2e test, TDD, test pyramid, test plan, test architecture.
version: 1.0.0
user-invocable: false
---

# Testing Strategy

## Test Pyramid

Follow the test pyramid distribution to balance speed, cost, and confidence:

- **Unit Tests (70%):** Test individual functions, methods, and classes in isolation. These run in milliseconds, have no external dependencies, and form the foundation of the test suite. Every public function should have at least one unit test.
- **Integration Tests (20%):** Test the interaction between two or more components, including database queries, API endpoints, and service-to-service communication. Use real dependencies where practical (e.g., test containers for databases) and mocks only for external third-party services.
- **End-to-End Tests (10%):** Test complete user workflows through the full stack. Keep these focused on critical paths only: signup, login, core business transactions, and payment flows. E2E tests are slow and brittle; do not use them to cover edge cases that unit tests can handle.

Rationale: Inverting the pyramid (heavy E2E, light unit) leads to slow CI pipelines, flaky builds, and poor developer experience. If a test can be written at a lower level, write it there.

## Coverage Targets

Set coverage targets based on module criticality, not a single global number:

- **Authentication and payment modules:** 90%+ line coverage, 85%+ branch coverage. These modules handle security and money; gaps here create real risk.
- **Core business logic:** 80%+ line coverage, 75%+ branch coverage. This includes domain models, validation rules, and business workflows.
- **API controllers and route handlers:** 70%+ line coverage. Focus on testing request validation, authorization checks, and response formatting.
- **Utility functions and helpers:** 60%+ line coverage. Simple utilities often have obvious behavior, but still test edge cases (empty input, null, boundary values).
- **Generated code, type definitions, and configuration:** Exclude from coverage metrics. Do not inflate coverage numbers by testing boilerplate.

Enforce coverage in CI as a ratchet: coverage can go up but never down. Use `--coverage-threshold` flags or equivalent to fail the build if coverage drops below the current baseline.

## Test Patterns

Follow the AAA pattern (Arrange, Act, Assert) for every test:

- **Arrange:** Set up the test data, dependencies, and preconditions. This should be the longest section.
- **Act:** Execute the single action being tested. This should be one line or a small focused block.
- **Assert:** Verify the outcome. Assert on behavior and output, not on implementation details.

Naming convention: Use the format `should [expected behavior] when [condition] given [initial state]`:

```
should return 404 when user does not exist
should send welcome email when registration succeeds given valid input
should throw ValidationError when email is empty
```

Additional rules:

- One logical assertion per test. Multiple `expect` calls are fine if they verify the same behavior (e.g., checking both status code and body).
- Never use conditional logic (`if`, `switch`, loops) inside test code. If you need different paths, write separate tests.
- Use descriptive variable names in tests: `expiredToken`, `adminUser`, `emptyCart` instead of `token1`, `user2`, `data`.
- Keep tests independent. No test should depend on another test running first or modifying shared state.
- Avoid magic numbers and strings. Use named constants or factory functions.

## Stack-Specific Tools

| Language/Runtime | Unit Testing        | Mocking/Stubbing     | Integration          | E2E                  |
|------------------|---------------------|----------------------|----------------------|----------------------|
| JavaScript/TS    | Vitest or Jest      | vi.mock / jest.mock  | Supertest, Testcontainers | Playwright, Cypress |
| Python           | pytest              | unittest.mock, pytest-mock | pytest + httpx, Testcontainers | Playwright, Selenium |
| Go               | go test + testify   | gomock, testify/mock | httptest, Testcontainers | chromedp             |
| Rust             | cargo test          | mockall              | reqwest + test server | --                   |
| Java/Kotlin      | JUnit 5 + Mockito   | Mockito, MockK       | Spring Boot Test, Testcontainers | Selenium, Playwright |

Selection rules:

- Use the tool that is already established in the project. Do not introduce a second test framework unless the first cannot cover a use case.
- For new JavaScript/TypeScript projects, prefer Vitest over Jest for faster execution and native ESM support.
- For database integration tests, prefer Testcontainers over in-memory fakes (e.g., prefer Testcontainers PostgreSQL over SQLite) to match production behavior.
- For E2E browser tests, prefer Playwright over Cypress for cross-browser support and better async handling.

## Test Organization

Organize test files to maximize discoverability and minimize context-switching:

- **Colocate unit tests** with the source file they test. Place `user.service.test.ts` next to `user.service.ts`, not in a separate `tests/` tree.
- **Place integration and E2E tests** in a dedicated top-level directory: `tests/integration/` and `tests/e2e/`. These tests span multiple modules and do not belong next to any single source file.
- **Shared test utilities** go in `tests/helpers/` or `tests/support/`. This includes custom matchers, test database setup, and authentication helpers.
- **Fixtures** go in `tests/fixtures/` or colocated `__fixtures__/` directories. Use JSON, YAML, or factory functions. Never hardcode large data blobs inside test files.
- **Factories** use the builder or factory pattern to create test objects: `createUser({ role: 'admin' })` instead of repeating full object literals in every test.
- Name test files with a consistent suffix: `.test.ts`, `.spec.ts`, `_test.go`, `_test.py`. Pick one convention per project and enforce it.

## Mock Strategies

When to mock:

- **External HTTP services:** Always mock third-party APIs (Stripe, SendGrid, AWS). Use recorded responses or contract tests.
- **System clock:** Mock `Date.now()` or equivalent when testing time-dependent logic (expiration, scheduling).
- **Random number generators:** Mock when testing code that uses randomness (ID generation, sampling).
- **File system and network:** Mock in unit tests; use real resources in integration tests.

When NOT to mock:

- **Your own code:** Do not mock your own services, repositories, or utilities in integration tests. If you mock everything, you test nothing.
- **Data transformations:** Test the actual transformation logic, not a mock that returns the expected output.
- **Database queries in integration tests:** Use a real test database to catch SQL errors, constraint violations, and migration issues.

Mock types:

- **Stub:** Returns predefined data. Use when you need to control what a dependency returns.
- **Spy:** Records calls without changing behavior. Use when you need to verify a function was called with specific arguments.
- **Fake:** A simplified working implementation (e.g., in-memory repository). Use when the real dependency is too slow or complex for unit tests but you need realistic behavior.

Rule: If a test has more mock setup than actual assertions, the test is testing the mocks, not the code. Refactor or move to integration level.

## CI Integration

- Run the full unit test suite on every push and every pull request. Unit tests must complete in under 5 minutes.
- Run integration tests on pull requests targeting main/develop. Use parallelization and test containers to keep runtime under 10 minutes.
- Run E2E tests on merge to main or on a scheduled nightly build. E2E suites over 15 minutes should be split into parallel shards.
- Fail the build if coverage decreases from the previous baseline. Use coverage diff tools (`diff-cover`, `codecov`) to review coverage on changed lines.
- Report test results as PR comments or status checks. Include test count, pass/fail, coverage delta, and a link to the full report.
- Cache test dependencies (node_modules, pip cache, go modules) between CI runs to reduce setup time.
- Run tests in a clean environment every time. Do not rely on state from previous CI runs.

## Anti-Patterns

- **Testing implementation details:** Asserting on internal state, private method calls, or the exact sequence of internal operations. Test the public interface and observable behavior instead.
- **Flaky tests:** Tests that pass and fail intermittently due to timing, ordering, or shared state. Fix or delete flaky tests immediately; they erode trust in the entire suite.
- **Snapshot abuse:** Using snapshots for large objects, HTML output, or API responses. Snapshots are acceptable for small, stable structures (e.g., a serialized config object). For everything else, assert on specific fields.
- **Tests that test nothing:** Tests with no assertions, tests that only verify a function does not throw, or tests where the mock returns exactly what the assertion checks. Every test must verify meaningful behavior.
- **Logic in test code:** Conditionals, loops, or complex computations inside tests. If the test needs logic to determine the expected result, extract it into a helper and test that helper separately.
- **Testing private methods:** If you need to test a private method, it is a sign that the method should be extracted into its own module or that the public method wrapping it has insufficient tests.
- **Ignoring test failures:** Skipping tests with `.skip` or `@Ignore` and leaving them indefinitely. Skipped tests accumulate and hide regressions. Either fix the test or delete it.
- **Shared mutable state between tests:** Global variables, database rows, or files modified by one test and read by another. Each test must set up and tear down its own state.
