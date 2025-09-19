#!/bin/bash

# Development helper script for Document Manager
# Provides convenient commands for common development tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Start development environment
start_dev() {
    print_info "Starting development environment..."

    if [ "${USE_DOCKER:-}" = "true" ]; then
        check_docker
        docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
        print_success "Docker development environment started"
        print_info "Application: http://localhost:3000"
        print_info "Grafana: http://localhost:3001 (admin/admin)"
        print_info "Prometheus: http://localhost:9091"
    else
        npm run dev
    fi
}

# Stop development environment
stop_dev() {
    print_info "Stopping development environment..."

    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose down
        print_success "Docker environment stopped"
    elif docker compose version >/dev/null 2>&1; then
        docker compose down
        print_success "Docker environment stopped"
    else
        print_warning "Docker Compose not found, stopping local processes only"
        pkill -f "npm run dev" || true
    fi
}

# Restart development environment
restart_dev() {
    print_info "Restarting development environment..."
    stop_dev
    sleep 2
    start_dev
}

# View logs
view_logs() {
    if [ "${USE_DOCKER:-}" = "true" ]; then
        check_docker
        if [ -n "$1" ]; then
            docker-compose logs -f "$1"
        else
            docker-compose logs -f
        fi
    else
        print_info "Viewing local logs..."
        if [ -d "logs" ]; then
            tail -f logs/*.log 2>/dev/null || print_warning "No log files found"
        else
            print_warning "Logs directory not found"
        fi
    fi
}

# Run tests
run_tests() {
    print_info "Running tests..."

    case "${1:-all}" in
        "unit")
            npm run test
            ;;
        "coverage")
            npm run test:coverage
            ;;
        "watch")
            npm run test -- --watch
            ;;
        "ui")
            npm run test:ui
            ;;
        "all"|*)
            npm run test:coverage
            ;;
    esac

    print_success "Tests completed"
}

# Run linting and formatting
run_lint() {
    print_info "Running linter..."

    case "${1:-check}" in
        "fix")
            npm run lint:fix
            print_success "Linting and auto-fix completed"
            ;;
        "check"|*)
            npm run lint
            print_success "Linting completed"
            ;;
    esac
}

# Type checking
run_typecheck() {
    print_info "Running type check..."
    npm run typecheck
    print_success "Type checking completed"
}

# Clean build artifacts
clean() {
    print_info "Cleaning build artifacts..."

    # Remove build directories
    rm -rf dist/
    rm -rf .cache/
    rm -rf node_modules/.cache/

    # Remove logs
    if [ -d "logs" ]; then
        rm -f logs/*.log
    fi

    print_success "Cleanup completed"
}

# Reset development environment
reset() {
    print_info "Resetting development environment..."

    stop_dev
    clean

    # Remove node_modules
    if [ "${HARD_RESET:-}" = "true" ]; then
        print_warning "Performing hard reset (removing node_modules)..."
        rm -rf node_modules/
        npm install
    fi

    # Reset Docker environment
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose down -v --remove-orphans
        print_info "Docker environment reset"
    fi

    print_success "Environment reset completed"
}

# Build application
build() {
    print_info "Building application..."

    case "${1:-prod}" in
        "lib")
            npm run build:lib
            print_success "Library build completed"
            ;;
        "prod"|*)
            npm run build
            print_success "Production build completed"
            ;;
    esac
}

# Health check
health_check() {
    print_info "Performing health check..."

    local failed=0

    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_error "Dependencies not installed"
        failed=1
    else
        print_success "Dependencies installed"
    fi

    # Check if TypeScript compiles
    if npm run typecheck >/dev/null 2>&1; then
        print_success "TypeScript compilation"
    else
        print_error "TypeScript compilation failed"
        failed=1
    fi

    # Check if tests pass
    if npm run test >/dev/null 2>&1; then
        print_success "Tests passing"
    else
        print_warning "Tests failing or not configured"
    fi

    # Check Docker environment (if running)
    if [ "${USE_DOCKER:-}" = "true" ]; then
        if docker-compose ps | grep -q "Up"; then
            print_success "Docker services running"
        else
            print_warning "Docker services not running"
        fi
    fi

    if [ $failed -eq 0 ]; then
        print_success "Health check passed"
        return 0
    else
        print_error "Health check failed"
        return 1
    fi
}

# Show status
show_status() {
    print_info "Development Environment Status"
    echo ""

    # Node.js status
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION"
    else
        print_error "Node.js not found"
    fi

    # npm status
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        print_success "npm v$NPM_VERSION"
    else
        print_error "npm not found"
    fi

    # Docker status
    if command -v docker >/dev/null 2>&1; then
        if docker info >/dev/null 2>&1; then
            print_success "Docker running"

            # Show running containers
            RUNNING_CONTAINERS=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
            if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
                print_info "$RUNNING_CONTAINERS Docker services running"
            else
                print_warning "No Docker services running"
            fi
        else
            print_warning "Docker not running"
        fi
    else
        print_warning "Docker not available"
    fi

    # Application status
    if [ -f "package.json" ]; then
        APP_VERSION=$(node -p "require('./package.json').version")
        print_info "Application version: $APP_VERSION"
    fi

    echo ""
}

# Show help
show_help() {
    echo "Document Manager Development Helper"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start              Start development environment"
    echo "  stop               Stop development environment"
    echo "  restart            Restart development environment"
    echo "  logs [service]     View logs (optionally for specific service)"
    echo "  test [type]        Run tests (unit|coverage|watch|ui|all)"
    echo "  lint [mode]        Run linter (check|fix)"
    echo "  typecheck          Run TypeScript type checking"
    echo "  build [type]       Build application (prod|lib)"
    echo "  clean              Clean build artifacts"
    echo "  reset              Reset development environment"
    echo "  health             Perform health check"
    echo "  status             Show environment status"
    echo "  help               Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  USE_DOCKER=true    Use Docker for development"
    echo "  HARD_RESET=true    Perform hard reset (removes node_modules)"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start with npm"
    echo "  USE_DOCKER=true $0 start    # Start with Docker"
    echo "  $0 test coverage            # Run tests with coverage"
    echo "  $0 lint fix                 # Run linter with auto-fix"
    echo "  HARD_RESET=true $0 reset    # Hard reset environment"
    echo ""
}

# Main command processing
case "${1:-help}" in
    "start"|"dev")
        start_dev
        ;;
    "stop")
        stop_dev
        ;;
    "restart")
        restart_dev
        ;;
    "logs")
        view_logs "$2"
        ;;
    "test")
        run_tests "$2"
        ;;
    "lint")
        run_lint "$2"
        ;;
    "typecheck"|"types")
        run_typecheck
        ;;
    "build")
        build "$2"
        ;;
    "clean")
        clean
        ;;
    "reset")
        reset
        ;;
    "health")
        health_check
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac