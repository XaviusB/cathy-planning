# Cathy Planning

A cross-platform local desktop team-planning application built with **C# / .NET 8** and **Avalonia UI**.

## Features

- **Weekly calendar view** with per-employee shift blocks
- **Drag & drop** to move shifts between days and hours
- **Edge-drag resize** to adjust shift duration
- **6-week rotation** (configurable)
- **Statutory rest validation**: minimum 11h between shifts, 35h weekly rest (configurable)
- **Right panel**: worked-hours summary and compliance report
- **Auto-generate plan** that respects rest rules
- **YAML save / load** for full session persistence

## Architecture

```
cathy-planning/
├── src/
│   ├── CathyPlanning.App/           # Avalonia UI desktop application
│   │   ├── MainWindow.axaml(.cs)    # Calendar + drag/drop/resize
│   │   └── ViewModels/              # MainViewModel, ShiftViewModel
│   ├── CathyPlanning.Domain/        # Core business logic (no UI dependency)
│   │   ├── Entities/                # PlanningSession, Employee, ShiftAssignment
│   │   ├── ValueObjects/            # RotationDefinition, RestRule
│   │   └── Services/                # ComplianceService, PlannerService
│   └── CathyPlanning.Infrastructure/ # YamlDotNet persistence
│       └── Persistence/             # SessionRepository, YAML models
└── tests/
    └── CathyPlanning.Domain.Tests/  # xUnit domain tests
```

## Local Build & Run

**Prerequisites**: .NET 8 SDK ([download](https://dotnet.microsoft.com/download/dotnet/8.0))

```bash
# Restore, build, test
dotnet restore
dotnet build
dotnet test

# Run the app
dotnet run --project src/CathyPlanning.App
```

## Creating a Release

```bash
# Tag and push to trigger the release workflow
git tag v1.2.3
git push origin v1.2.3
```

GitHub Actions will build self-contained executables for all platforms and attach them to a GitHub Release automatically.

## Release Artifacts

After a tag push, artifacts are available in the GitHub Release as:

| Platform | File |
|----------|------|
| Windows x64 | `CathyPlanning-v1.2.3-win-x64.zip` |
| Linux x64 | `CathyPlanning-v1.2.3-linux-x64.zip` |
| macOS x64 | `CathyPlanning-v1.2.3-osx-x64.zip` |
| macOS ARM64 | `CathyPlanning-v1.2.3-osx-arm64.zip` |

Each zip contains a single self-contained executable — no .NET runtime required on the target machine.

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push / PR | Build + test on Windows, Linux, macOS |
| `release.yml` | Tag `v*` | Publish self-contained binaries + GitHub Release |
