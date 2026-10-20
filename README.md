# QuizApp

Full-stack quiz and assessment platform built with **ASP.NET Core 8** (Clean Architecture, EF Core, SQL Server, JWT) and **Angular 21**.

> Roadmap: it is being developed into an *Employee Assessment* module for an ERP system. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository layout

```
QuizApp.sln
src/
  QuizApp.Domain/           Entities, enums, domain rules (no framework dependencies)
  QuizApp.Application/      DTOs, mapping, error codes, paging contracts
  QuizApp.Infrastructure/   EF Core DbContext + migrations, seeding, password hashing, JWT
  QuizApp.Api/              ASP.NET Core REST API (controllers, startup)
  quizapp-frontend/         Angular 21 SPA
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
