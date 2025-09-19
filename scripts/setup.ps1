# Document Manager Setup Script for Windows PowerShell
# This script automates the initial setup of the Document Manager application

param(
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$SkipDocker,
    [switch]$Minimal,
    [switch]$Help
)

# Configuration
$ProjectName = "Document Manager"
$RequiredNodeVersion = 18
$RequiredDockerVersion = 20

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Cyan"
    White = "White"
}

function Write-Header {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor $Colors.Blue
    Write-Host "  $ProjectName Setup Script" -ForegroundColor $Colors.Blue
    Write-Host "======================================" -ForegroundColor $Colors.Blue
    Write-Host ""
}

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor $Colors.Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $Colors.Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $Colors.Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $Colors.Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor $Colors.Blue
}

function Test-Command {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-NodeVersion {
    if (Test-Command "node") {
        try {
            $nodeVersion = node --version
            $version = $nodeVersion.Substring(1)
            $majorVersion = [int]($version.Split('.')[0])

            if ($majorVersion -ge $RequiredNodeVersion) {
                Write-Success "Node.js v$version found"
                return $true
            } else {
                Write-Error "Node.js v$majorVersion found, but v$RequiredNodeVersion+ is required"
                return $false
            }
        } catch {
            Write-Error "Failed to check Node.js version"
            return $false
        }
    } else {
        Write-Error "Node.js not found"
        return $false
    }
}

function Test-Npm {
    if (Test-Command "npm") {
        try {
            $npmVersion = npm --version
            Write-Success "npm v$npmVersion found"
            return $true
        } catch {
            Write-Error "Failed to check npm version"
            return $false
        }
    } else {
        Write-Error "npm not found"
        return $false
    }
}

function Test-Docker {
    if (Test-Command "docker") {
        try {
            $dockerOutput = docker --version
            if ($dockerOutput -match "Docker version (\d+\.\d+)") {
                $dockerVersion = $matches[1]
                $majorVersion = [int]($dockerVersion.Split('.')[0])

                if ($majorVersion -ge $RequiredDockerVersion) {
                    Write-Success "Docker v$dockerVersion found"
                } else {
                    Write-Warning "Docker v$dockerVersion found, v$RequiredDockerVersion+ recommended"
                }
                return $true
            }
        } catch {
            Write-Warning "Failed to check Docker version"
        }
    } else {
        Write-Warning "Docker not found (optional for development)"
    }
    return $true
}

function Test-DockerCompose {
    if (Test-Command "docker-compose") {
        try {
            $composeOutput = docker-compose --version
            if ($composeOutput -match "docker-compose version (\d+\.\d+)") {
                $composeVersion = $matches[1]
                Write-Success "Docker Compose v$composeVersion found"
            } else {
                Write-Success "Docker Compose found"
            }
            return $true
        } catch {
            Write-Warning "Failed to check Docker Compose version"
        }
    } elseif (Test-Command "docker") {
        try {
            $null = docker compose version 2>$null
            Write-Success "Docker Compose (plugin) found"
            return $true
        } catch {
            Write-Warning "Docker Compose not found (optional for development)"
        }
    } else {
        Write-Warning "Docker Compose not found (optional for development)"
    }
    return $true
}

function Install-Dependencies {
    Write-Section "Installing Dependencies"

    try {
        if (Test-Path "package-lock.json") {
            Write-Info "Found package-lock.json, using npm ci for faster installation"
            npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
        } else {
            Write-Info "Installing dependencies with npm install"
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
        }

        Write-Success "Dependencies installed"
        return $true
    } catch {
        Write-Error "Failed to install dependencies: $_"
        return $false
    }
}

function Setup-Environment {
    Write-Section "Setting up Environment"

    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Success "Created .env file from .env.example"
            Write-Info "Please edit .env file with your configuration"
        } else {
            Write-Warning ".env.example not found, skipping environment setup"
        }
    } else {
        Write-Info ".env file already exists"
    }
}

function Test-TypeCheck {
    Write-Section "Running Type Check"

    try {
        npm run typecheck
        if ($LASTEXITCODE -ne 0) { throw "Type check failed" }
        Write-Success "Type check passed"
        return $true
    } catch {
        Write-Error "Type check failed: $_"
        return $false
    }
}

function Test-Linting {
    Write-Section "Running Linting"

    try {
        npm run lint
        if ($LASTEXITCODE -ne 0) { throw "Linting failed" }
        Write-Success "Linting passed"
        return $true
    } catch {
        Write-Error "Linting failed: $_"
        return $false
    }
}

function Test-Application {
    Write-Section "Running Tests"

    try {
        npm run test:coverage 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Tests passed"
            return $true
        } else {
            Write-Warning "Tests failed or not configured"
            return $true
        }
    } catch {
        Write-Warning "Tests failed or not configured"
        return $true
    }
}

function Build-Application {
    Write-Section "Building Application"

    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Success "Application built successfully"
        return $true
    } catch {
        Write-Error "Build failed: $_"
        return $false
    }
}

function Setup-Docker {
    Write-Section "Setting up Docker Environment"

    if (Test-Command "docker") {
        try {
            Write-Info "Pulling Docker images..."

            # Try docker-compose first, then docker compose
            try {
                docker-compose pull 2>$null
            } catch {
                try {
                    docker compose pull 2>$null
                } catch {
                    Write-Warning "Could not pull Docker images, they will be built on first run"
                }
            }

            Write-Success "Docker environment ready"
        } catch {
            Write-Warning "Docker setup encountered issues: $_"
        }
    } else {
        Write-Info "Skipping Docker setup (Docker not available)"
    }
}

function New-Directories {
    Write-Section "Creating Directories"

    # Create logs directory
    if (-not (Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" | Out-Null
    }
    Write-Success "Created logs directory"

    # Create cache directory
    if (-not (Test-Path ".cache")) {
        New-Item -ItemType Directory -Path ".cache" | Out-Null
    }
    Write-Success "Created cache directory"
}

function Show-Completion {
    Write-Section "Setup Complete!"

    Write-Host ""
    Write-Success "The Document Manager application is ready!"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor $Colors.White
    Write-Host ""
    Write-Info "1. Edit .env file with your API endpoints and keys"
    Write-Info "2. Start development server: npm run dev"
    Write-Info "3. Or start with Docker: docker-compose up"
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor $Colors.White
    Write-Host "  npm run dev          - Start development server"
    Write-Host "  npm run build        - Build for production"
    Write-Host "  npm run test         - Run tests"
    Write-Host "  npm run lint         - Run linting"
    Write-Host "  npm run typecheck    - Run type checking"
    Write-Host ""
    Write-Host "Docker commands:" -ForegroundColor $Colors.White
    Write-Host "  docker-compose up -d - Start all services in background"
    Write-Host "  docker-compose logs  - View logs"
    Write-Host "  docker-compose down  - Stop all services"
    Write-Host ""
    Write-Info "Check README.md for detailed documentation"
    Write-Host ""
}

function Show-Help {
    Write-Host "Document Manager Setup Script"
    Write-Host ""
    Write-Host "Usage: .\scripts\setup.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -SkipTests     Skip running tests"
    Write-Host "  -SkipBuild     Skip building application"
    Write-Host "  -SkipDocker    Skip Docker setup"
    Write-Host "  -Minimal       Skip tests, build, and Docker (fastest setup)"
    Write-Host "  -Help          Show this help message"
    Write-Host ""
}

function Start-Setup {
    Write-Header

    # Check prerequisites
    Write-Section "Checking Prerequisites"

    $prereqFailed = $false

    if (-not (Test-NodeVersion)) {
        $prereqFailed = $true
    }

    if (-not (Test-Npm)) {
        $prereqFailed = $true
    }

    Test-Docker | Out-Null
    Test-DockerCompose | Out-Null

    if ($prereqFailed) {
        Write-Error "Prerequisites check failed. Please install required software."
        exit 1
    }

    # Setup steps
    New-Directories
    Setup-Environment

    if (-not (Install-Dependencies)) {
        Write-Error "Dependency installation failed"
        exit 1
    }

    # Validation steps
    if (-not (Test-TypeCheck)) {
        Write-Error "Type check failed"
        exit 1
    }

    if (-not (Test-Linting)) {
        Write-Error "Linting failed"
        exit 1
    }

    # Optional steps
    if (-not $SkipTests -and -not $Minimal) {
        Test-Application | Out-Null
    }

    if (-not $SkipBuild -and -not $Minimal) {
        if (-not (Build-Application)) {
            Write-Error "Build failed"
            exit 1
        }
    }

    if (-not $SkipDocker -and -not $Minimal) {
        Setup-Docker
    }

    Show-Completion
}

# Main execution
if ($Help) {
    Show-Help
    exit 0
}

if ($Minimal) {
    $SkipTests = $true
    $SkipBuild = $true
    $SkipDocker = $true
}

Start-Setup