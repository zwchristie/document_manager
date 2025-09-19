#!/bin/bash

# Document Manager Setup Script
# This script automates the initial setup of the Document Manager application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
PROJECT_NAME="Document Manager"
REQUIRED_NODE_VERSION="18"
REQUIRED_DOCKER_VERSION="20"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "======================================"
    echo "  ${PROJECT_NAME} Setup Script"
    echo "======================================"
    echo -e "${NC}"
}

print_section() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node() {
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -c 2-)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)

        if [ "$MAJOR_VERSION" -ge "$REQUIRED_NODE_VERSION" ]; then
            print_success "Node.js v$NODE_VERSION found"
            return 0
        else
            print_error "Node.js v$MAJOR_VERSION found, but v$REQUIRED_NODE_VERSION+ is required"
            return 1
        fi
    else
        print_error "Node.js not found"
        return 1
    fi
}

# Check npm
check_npm() {
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm v$NPM_VERSION found"
        return 0
    else
        print_error "npm not found"
        return 1
    fi
}

# Check Docker
check_docker() {
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
        MAJOR_VERSION=$(echo $DOCKER_VERSION | cut -d. -f1)

        if [ "$MAJOR_VERSION" -ge "$REQUIRED_DOCKER_VERSION" ]; then
            print_success "Docker v$DOCKER_VERSION found"
            return 0
        else
            print_warning "Docker v$DOCKER_VERSION found, v$REQUIRED_DOCKER_VERSION+ recommended"
            return 0
        fi
    else
        print_warning "Docker not found (optional for development)"
        return 0
    fi
}

# Check Docker Compose
check_docker_compose() {
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        if command_exists docker-compose; then
            COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+' | head -1)
            print_success "Docker Compose v$COMPOSE_VERSION found"
        else
            print_success "Docker Compose (plugin) found"
        fi
        return 0
    else
        print_warning "Docker Compose not found (optional for development)"
        return 0
    fi
}

# Install dependencies
install_dependencies() {
    print_section "Installing Dependencies"

    if [ -f "package-lock.json" ]; then
        print_info "Found package-lock.json, using npm ci for faster installation"
        npm ci
    else
        print_info "Installing dependencies with npm install"
        npm install
    fi

    print_success "Dependencies installed"
}

# Setup environment file
setup_environment() {
    print_section "Setting up Environment"

    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from .env.example"
            print_info "Please edit .env file with your configuration"
        else
            print_warning ".env.example not found, skipping environment setup"
        fi
    else
        print_info ".env file already exists"
    fi
}

# Run type check
run_typecheck() {
    print_section "Running Type Check"

    npm run typecheck
    print_success "Type check passed"
}

# Run linting
run_linting() {
    print_section "Running Linting"

    npm run lint
    print_success "Linting passed"
}

# Run tests
run_tests() {
    print_section "Running Tests"

    if npm run test:coverage 2>/dev/null; then
        print_success "Tests passed"
    else
        print_warning "Tests failed or not configured"
    fi
}

# Build application
build_application() {
    print_section "Building Application"

    npm run build
    print_success "Application built successfully"
}

# Setup Docker (optional)
setup_docker() {
    print_section "Setting up Docker Environment"

    if command_exists docker; then
        # Pull required images
        print_info "Pulling Docker images..."
        docker-compose pull 2>/dev/null || docker compose pull 2>/dev/null || {
            print_warning "Could not pull Docker images, they will be built on first run"
        }

        print_success "Docker environment ready"
    else
        print_info "Skipping Docker setup (Docker not available)"
    fi
}

# Create necessary directories
create_directories() {
    print_section "Creating Directories"

    # Create logs directory
    mkdir -p logs
    print_success "Created logs directory"

    # Create cache directory
    mkdir -p .cache
    print_success "Created cache directory"
}

# Display completion message
display_completion() {
    print_section "Setup Complete!"

    echo ""
    print_success "The Document Manager application is ready!"
    echo ""
    echo "Next steps:"
    echo ""
    print_info "1. Edit .env file with your API endpoints and keys"
    print_info "2. Start development server: npm run dev"
    print_info "3. Or start with Docker: docker-compose up"
    echo ""
    echo "Useful commands:"
    echo "  npm run dev          - Start development server"
    echo "  npm run build        - Build for production"
    echo "  npm run test         - Run tests"
    echo "  npm run lint         - Run linting"
    echo "  npm run typecheck    - Run type checking"
    echo ""
    echo "Docker commands:"
    echo "  docker-compose up -d - Start all services in background"
    echo "  docker-compose logs  - View logs"
    echo "  docker-compose down  - Stop all services"
    echo ""
    print_info "Check README.md for detailed documentation"
    echo ""
}

# Main setup function
main() {
    print_header

    # Check prerequisites
    print_section "Checking Prerequisites"

    local prereq_failed=false

    if ! check_node; then
        prereq_failed=true
    fi

    if ! check_npm; then
        prereq_failed=true
    fi

    check_docker
    check_docker_compose

    if [ "$prereq_failed" = true ]; then
        print_error "Prerequisites check failed. Please install required software."
        exit 1
    fi

    # Setup steps
    create_directories
    setup_environment
    install_dependencies

    # Validation steps
    run_typecheck
    run_linting

    # Optional steps
    if [ "${SKIP_TESTS:-}" != "true" ]; then
        run_tests
    fi

    if [ "${SKIP_BUILD:-}" != "true" ]; then
        build_application
    fi

    if [ "${SKIP_DOCKER:-}" != "true" ]; then
        setup_docker
    fi

    display_completion
}

# Handle command line arguments
case "${1:-}" in
    --skip-tests)
        export SKIP_TESTS=true
        main
        ;;
    --skip-build)
        export SKIP_BUILD=true
        main
        ;;
    --skip-docker)
        export SKIP_DOCKER=true
        main
        ;;
    --minimal)
        export SKIP_TESTS=true
        export SKIP_BUILD=true
        export SKIP_DOCKER=true
        main
        ;;
    --help|-h)
        echo "Document Manager Setup Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --skip-tests   Skip running tests"
        echo "  --skip-build   Skip building application"
        echo "  --skip-docker  Skip Docker setup"
        echo "  --minimal      Skip tests, build, and Docker (fastest setup)"
        echo "  --help, -h     Show this help message"
        echo ""
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac