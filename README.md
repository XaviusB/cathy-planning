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

The build process is identical on all platforms — only the .NET 8 SDK installation step differs.

### Prerequisites

<details>
<summary><strong>Linux (Ubuntu / Debian)</strong></summary>

```bash
# Add Microsoft package feed and install the SDK
wget https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb

sudo apt-get update
sudo apt-get install -y dotnet-sdk-8.0
```

Or follow the [official Linux install guide](https://learn.microsoft.com/dotnet/core/install/linux).

> **Note (Avalonia UI):** On headless servers you may need X11/Wayland libraries:
> ```bash
> sudo apt-get install -y libx11-dev libxrandr-dev libxi-dev libxcursor-dev libxdamage-dev
> ```

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Download the **.NET 8 SDK** installer from <https://dotnet.microsoft.com/download/dotnet/8.0>.
2. Run the installer and follow the prompts.
3. Open **Command Prompt**, **PowerShell**, or **Windows Terminal** and verify:
   ```powershell
   dotnet --version
   ```

</details>

<details>
<summary><strong>macOS (Intel & Apple Silicon)</strong></summary>

**Option A – installer:**
1. Download the **.NET 8 SDK** `.pkg` for your architecture (x64 or Arm64) from <https://dotnet.microsoft.com/download/dotnet/8.0>.
2. Run the package and follow the prompts.

**Option B – Homebrew:**
```bash
brew install --cask dotnet-sdk
```

Verify the installation:
```bash
dotnet --version
```

</details>

---

### Build, Test & Run

Once the SDK is installed, the following commands work identically on Linux, Windows, and macOS:

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/XaviusB/cathy-planning.git
cd cathy-planning

# Restore dependencies
dotnet restore

# Build (Release configuration)
dotnet build -c Release

# Run the test suite
dotnet test -c Release

# Launch the desktop application
dotnet run --project src/CathyPlanning.App
```

> **Windows users:** use **PowerShell** or **Command Prompt** — the commands above are identical.

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
