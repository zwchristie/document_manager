#!/bin/bash

# Production deployment script for Document Manager
# Handles building, testing, and deploying the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_NAME="${IMAGE_NAME:-document-manager}"
TAG="${TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"

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

print_section() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"

    local failed=false

    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        print_error "Node.js not found"
        failed=true
    else
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION found"
    fi

    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        print_error "npm not found"
        failed=true
    else
        NPM_VERSION=$(npm --version)
        print_success "npm v$NPM_VERSION found"
    fi

    # Check Docker (if needed)
    if [ "${USE_DOCKER:-}" = "true" ]; then
        if ! command -v docker >/dev/null 2>&1; then
            print_error "Docker not found"
            failed=true
        else
            if ! docker info >/dev/null 2>&1; then
                print_error "Docker is not running"
                failed=true
            else
                print_success "Docker is running"
            fi
        fi
    fi

    if [ "$failed" = true ]; then
        print_error "Prerequisites check failed"
        exit 1
    fi
}

# Install production dependencies
install_dependencies() {
    print_section "Installing Dependencies"

    npm ci --only=production
    print_success "Production dependencies installed"
}

# Run tests
run_tests() {
    print_section "Running Tests"

    # Install dev dependencies for testing
    npm ci

    # Type checking
    npm run typecheck
    print_success "Type checking passed"

    # Linting
    npm run lint
    print_success "Linting passed"

    # Unit tests
    npm run test
    print_success "Tests passed"
}

# Build application
build_application() {
    print_section "Building Application"

    # Clean previous build
    rm -rf dist/

    # Build for production
    NODE_ENV=production npm run build
    print_success "Application built successfully"

    # Verify build output
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        print_error "Build output is empty or missing"
        exit 1
    fi

    print_success "Build verification passed"
}

# Build Docker image
build_docker_image() {
    print_section "Building Docker Image"

    local image_tag="${IMAGE_NAME}:${TAG}"

    if [ -n "$DOCKER_REGISTRY" ]; then
        image_tag="${DOCKER_REGISTRY}/${image_tag}"
    fi

    print_info "Building image: $image_tag"

    docker build \
        --build-arg NODE_ENV=$ENVIRONMENT \
        --build-arg LLM_API_URL="$LLM_API_URL" \
        --build-arg QA_API_URL="$QA_API_URL" \
        --build-arg DOC_API_URL="$DOC_API_URL" \
        -t "$image_tag" \
        .

    print_success "Docker image built: $image_tag"

    # Tag as latest if not already
    if [ "$TAG" != "latest" ]; then
        local latest_tag="${IMAGE_NAME}:latest"
        if [ -n "$DOCKER_REGISTRY" ]; then
            latest_tag="${DOCKER_REGISTRY}/${latest_tag}"
        fi
        docker tag "$image_tag" "$latest_tag"
        print_info "Tagged as latest: $latest_tag"
    fi
}

# Push Docker image
push_docker_image() {
    print_section "Pushing Docker Image"

    if [ -z "$DOCKER_REGISTRY" ]; then
        print_warning "No Docker registry specified, skipping push"
        return 0
    fi

    local image_tag="${DOCKER_REGISTRY}/${IMAGE_NAME}:${TAG}"
    local latest_tag="${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"

    print_info "Pushing image: $image_tag"
    docker push "$image_tag"
    print_success "Pushed: $image_tag"

    if [ "$TAG" != "latest" ]; then
        print_info "Pushing latest tag: $latest_tag"
        docker push "$latest_tag"
        print_success "Pushed: $latest_tag"
    fi
}

# Deploy to environment
deploy_application() {
    print_section "Deploying Application"

    case "$ENVIRONMENT" in
        "production")
            deploy_production
            ;;
        "staging")
            deploy_staging
            ;;
        "docker")
            deploy_docker
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Deploy to production (customize for your infrastructure)
deploy_production() {
    print_info "Deploying to production environment"

    # This is a template - customize for your infrastructure
    # Examples:
    # - kubectl apply -f k8s/
    # - docker-compose -f docker-compose.prod.yml up -d
    # - rsync dist/ user@server:/var/www/html/
    # - AWS ECS/Fargate deployment
    # - Azure Container Instances
    # - Google Cloud Run

    print_warning "Production deployment not configured"
    print_info "Please customize the deploy_production function for your infrastructure"
}

# Deploy to staging
deploy_staging() {
    print_info "Deploying to staging environment"

    # Example staging deployment
    if [ -f "docker-compose.staging.yml" ]; then
        docker-compose -f docker-compose.staging.yml up -d
        print_success "Deployed to staging with Docker Compose"
    else
        print_warning "Staging deployment configuration not found"
    fi
}

# Deploy with Docker
deploy_docker() {
    print_info "Deploying with Docker"

    # Use production Docker Compose configuration
    if [ -f "docker-compose.prod.yml" ]; then
        docker-compose -f docker-compose.prod.yml up -d
    else
        docker-compose up -d
    fi

    print_success "Deployed with Docker Compose"
}

# Health check after deployment
post_deploy_health_check() {
    print_section "Post-Deployment Health Check"

    local health_url="${HEALTH_CHECK_URL:-http://localhost:3000/health}"
    local max_attempts=30
    local attempt=1

    print_info "Checking application health at: $health_url"

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" >/dev/null 2>&1; then
            print_success "Application is healthy"
            return 0
        fi

        print_info "Attempt $attempt/$max_attempts - waiting for application..."
        sleep 10
        attempt=$((attempt + 1))
    done

    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Rollback deployment
rollback() {
    print_section "Rolling Back Deployment"

    case "$ENVIRONMENT" in
        "docker")
            if [ -n "$ROLLBACK_TAG" ]; then
                local image_tag="${IMAGE_NAME}:${ROLLBACK_TAG}"
                if [ -n "$DOCKER_REGISTRY" ]; then
                    image_tag="${DOCKER_REGISTRY}/${image_tag}"
                fi

                print_info "Rolling back to: $image_tag"

                # Update image tag in docker-compose and redeploy
                sed -i.bak "s|${IMAGE_NAME}:.*|${image_tag}|" docker-compose.yml
                docker-compose up -d
                mv docker-compose.yml.bak docker-compose.yml

                print_success "Rolled back to $ROLLBACK_TAG"
            else
                print_error "ROLLBACK_TAG not specified"
                exit 1
            fi
            ;;
        *)
            print_error "Rollback not implemented for environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Create deployment report
create_deployment_report() {
    print_section "Creating Deployment Report"

    local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "version": "$(node -p 'require("./package.json").version' 2>/dev/null || echo 'unknown')",
    "tag": "$TAG",
    "image": "${IMAGE_NAME}:${TAG}",
    "registry": "$DOCKER_REGISTRY",
    "deployer": "$(whoami)",
    "hostname": "$(hostname)",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  }
}
EOF

    print_success "Deployment report created: $report_file"
}

# Show help
show_help() {
    echo "Document Manager Deployment Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  deploy             Full deployment (test, build, deploy)"
    echo "  build              Build only (test, build)"
    echo "  docker             Build and push Docker image"
    echo "  rollback           Rollback deployment"
    echo "  health-check       Perform health check"
    echo "  help               Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ENVIRONMENT        Target environment (production|staging|docker)"
    echo "  DOCKER_REGISTRY    Docker registry URL"
    echo "  IMAGE_NAME         Docker image name (default: document-manager)"
    echo "  TAG                Image tag (default: latest)"
    echo "  LLM_API_URL        LLM service endpoint"
    echo "  QA_API_URL         Q&A service endpoint"
    echo "  DOC_API_URL        Document service endpoint"
    echo "  HEALTH_CHECK_URL   Health check endpoint"
    echo "  ROLLBACK_TAG       Tag to rollback to"
    echo "  SKIP_TESTS         Skip tests (true|false)"
    echo "  USE_DOCKER         Use Docker for deployment"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                                    # Deploy to default environment"
    echo "  ENVIRONMENT=production $0 deploy             # Deploy to production"
    echo "  TAG=v1.2.3 $0 docker                       # Build and push specific tag"
    echo "  ROLLBACK_TAG=v1.2.2 $0 rollback            # Rollback to previous version"
    echo ""
}

# Main deployment function
main() {
    case "${1:-help}" in
        "deploy")
            check_prerequisites
            if [ "${SKIP_TESTS:-}" != "true" ]; then
                install_dependencies
                run_tests
            fi
            build_application
            if [ "${USE_DOCKER:-}" = "true" ]; then
                build_docker_image
                push_docker_image
            fi
            deploy_application
            post_deploy_health_check
            create_deployment_report
            print_success "Deployment completed successfully"
            ;;
        "build")
            check_prerequisites
            if [ "${SKIP_TESTS:-}" != "true" ]; then
                install_dependencies
                run_tests
            fi
            build_application
            print_success "Build completed successfully"
            ;;
        "docker")
            check_prerequisites
            build_docker_image
            push_docker_image
            print_success "Docker build and push completed"
            ;;
        "rollback")
            rollback
            post_deploy_health_check
            ;;
        "health-check")
            post_deploy_health_check
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
}

# Execute main function
main "$@"