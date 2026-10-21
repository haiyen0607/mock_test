# QuizApp

[![CI](https://github.com/haiyen0607/mock_test/actions/workflows/ci.yml/badge.svg)](https://github.com/haiyen0607/mock_test/actions/workflows/ci.yml)

Full-stack quiz and assessment platform built with **ASP.NET Core 8** (Clean Architecture, EF Core, SQL Server, JWT) and **Angular 21**.

> Roadmap: it is being developed into an *Employee Assessment* module for an ERP system. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository layout

```
QuizApp.sln
src/
  QuizApp.Domain/           Entities, enums, domain rules, scoring strategies (no framework dependencies)
  QuizApp.Application/      Use-case services (Result pattern), DTOs, mapping, error codes, abstractions
  QuizApp.Infrastructure/   EF Core DbContext + migrations, seeding, password hashing, JWT
  QuizApp.Api/              ASP.NET Core REST API (controllers, startup)
  quizapp-frontend/         Angular 21 SPA
tests/
  QuizApp.Domain.Tests/           Unit tests: scoring strategies, question-type rules
  QuizApp.Application.Tests/      Unit tests: validators, services (Moq + EF Core InMemory)
  QuizApp.Api.IntegrationTests/   End-to-end API tests (WebApplicationFactory + SQL Server LocalDB)
.github/workflows/ci.yml    CI: build + all tests (Windows, LocalDB) and Angular build
docs/
  ROADMAP.md                Plan to grow the project into a portfolio piece for .NET jobs
  API_CHANGES.md            API contract: endpoints, JSON shapes, error codes, paging
dotnet-tools.json           Local .NET tools (dotnet-ef)
```

Dependencies point inwards: `Api → Infrastructure → Application → Domain`.

## Getting started

Requirements: .NET 8 SDK, SQL Server LocalDB (or SQL Server), Node.js 22.

```bash
# Backend: http://localhost:5080 (API reference at /scalar)
dotnet tool restore
dotnet run --project src/QuizApp.Api

# Frontend: http://localhost:4200
cd src/quizapp-frontend
npm install
npm start
```

On first run in Development, the API applies EF Core migrations and seeds two sample accounts: `admin` / `Admin@123` and `hoanganh` / `User@123`.

Backend details (configuration, secrets, migrations, endpoints): [src/QuizApp.Api/README.md](src/QuizApp.Api/README.md).

## Tests

```bash
dotnet test QuizApp.sln -c Release
```

| Project | Scope | Tests |
|---|---|---|
| `QuizApp.Domain.Tests` | Scoring (Strategy pattern), question-type rules | 110 |
| `QuizApp.Application.Tests` | FluentValidation validators, `Result`, services with Moq | 156 |
| `QuizApp.Api.IntegrationTests` | Every endpoint end-to-end through HTTP, EF Core and SQL Server | 107 |

Integration tests start the API in memory (`WebApplicationFactory`) against a throw-away LocalDB database
(`QuizAppDb_IT_<guid>`), created by migrations and dropped afterwards — the development database is never touched.
CI runs the same suite on every push and pull request.
