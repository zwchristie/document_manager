# Infrastructure & DevOps Setup

## Overview

The Document Manager application includes a comprehensive infrastructure setup designed for enterprise-scale deployment with full observability, automated setup, and production-ready containerization.

## Configuration Management

### Centralized Configuration System

Located in `config/app.config.ts`, the application uses a robust configuration management system:

- **Zod-based Validation**: All configuration is validated at startup
- **Environment Support**: Development, staging, and production configurations
- **Type Safety**: Full TypeScript support for configuration objects
- **Hot Reloading**: Configuration can be reloaded without restart

### Configuration Sections

1. **App Configuration**: Basic application settings
2. **API Configuration**: Service endpoint configurations with retry policies
3. **Feature Flags**: Enable/disable features dynamically
4. **Security Settings**: Rate limiting, CORS, input sanitization
5. **Observability Settings**: Logging, metrics, and health check configuration

### Environment Variables

The application supports extensive environment-based configuration:

```bash
# Application
APP_NAME=Document Manager
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# API Endpoints
LLM_API_URL=http://localhost:8001
QA_API_URL=http://localhost:8002
DOC_API_URL=http://localhost:8003

# Feature Flags
ENABLE_METRICS=true
ENABLE_TRACING=false
ENABLE_HEALTH_CHECKS=true

# Security
ENABLE_RATE_LIMIT=true
MAX_REQUESTS_PER_MINUTE=100
```

## Observability & Telemetry

### Structured Logging

**Implementation**: Custom logger wrapper around Pino
**Location**: `utils/logger.ts`

Features:
- Structured JSON logging in production
- Pretty-printed logs in development
- Context-aware logging with request IDs
- Business event tracking
- Performance metrics logging
- Error tracking with stack traces

```typescript
logger.info('Document enrichment started', {
  component: 'LLMService',
  operation: 'enrichDocument',
  requestId: 'req_123',
  metadata: { documentType: 'microservice' }
})
```

### Metrics Collection

**Implementation**: Custom metrics collector with Prometheus integration
**Location**: `utils/metrics.ts`

Metrics Types:
- **Counters**: API requests, errors, business events
- **Gauges**: System resources, active connections
- **Histograms**: Request durations, processing times

Pre-defined Application Metrics:
- API call performance and error rates
- Document operation success/failure rates
- LLM request metrics (tokens, duration, model)
- Cache hit/miss rates
- User action tracking
- System resource utilization

### Health Monitoring

**Implementation**: Comprehensive health check system
**Location**: `utils/healthCheck.ts`

Health Checks:
- Memory usage monitoring
- Configuration validation
- API endpoint availability
- Database connection status
- Cache connectivity
- Custom business logic checks

Health Status Levels:
- **Healthy**: All systems operational
- **Degraded**: Some non-critical issues
- **Unhealthy**: Critical failures detected

## Docker Support

### Multi-Stage Dockerfile

The application includes an optimized multi-stage Docker build:

1. **Base Stage**: Node.js Alpine image
2. **Dependencies Stage**: Production dependency installation
3. **Builder Stage**: Type checking and application build
4. **Runner Stage**: Minimal production runtime

Features:
- Security: Non-root user execution
- Optimization: Multi-stage builds for minimal image size
- Health Checks: Built-in container health monitoring
- Build Args: Configurable API endpoints

### Docker Compose Configuration

#### Development Environment (`docker-compose.override.yml`)
- Hot reloading with volume mounts
- Debug logging enabled
- Development API endpoints
- Vite HMR support

#### Production Environment (`docker-compose.yml`)
- Mock API services for testing
- Redis for caching
- Prometheus for metrics collection
- Grafana for metrics visualization
- Health checks for all services

### Service Architecture

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Document       │ │  LLM Service    │ │  Q&A Service    │
│  Manager        │ │  (Mock)         │ │  (Mock)         │
│  :3000          │ │  :8001          │ │  :8002          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
         ┌─────────────────────────────────────────┐
         │              Network                    │
         │         document-manager-network        │
         └─────────────────────────────────────────┘
                              │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Doc Service    │ │  Redis          │ │  Prometheus     │
│  (Mock)         │ │  Cache          │ │  Metrics        │
│  :8003          │ │  :6379          │ │  :9091          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                                               │
                              ┌─────────────────┐
                              │  Grafana        │
                              │  Dashboard      │
                              │  :3001          │
                              └─────────────────┘
```

## Automated Setup & Development

### Cross-Platform Setup Scripts

#### Linux/macOS (`scripts/setup.sh`)
- Prerequisite checking (Node.js, npm, Docker)
- Dependency installation with optimization
- Environment file creation
- Type checking and linting
- Optional test execution and build
- Docker environment preparation
- Comprehensive completion report

#### Windows (`scripts/setup.ps1`)
- PowerShell implementation with same features
- Windows-specific path handling
- Error handling and user feedback
- Color-coded output for better UX

### Development Helper Script (`scripts/dev.sh`)

Provides convenient commands for common development tasks:

```bash
# Start development environment
./scripts/dev.sh start
USE_DOCKER=true ./scripts/dev.sh start

# Run tests with options
./scripts/dev.sh test coverage
./scripts/dev.sh test watch

# Linting and type checking
./scripts/dev.sh lint fix
./scripts/dev.sh typecheck

# Environment management
./scripts/dev.sh clean
./scripts/dev.sh reset
./scripts/dev.sh health
```

### Deployment Automation (`scripts/deploy.sh`)

Production deployment script with:
- Pre-deployment validation
- Comprehensive testing
- Docker image building and pushing
- Environment-specific deployment
- Post-deployment health checks
- Rollback capabilities
- Deployment reporting

## Monitoring & Alerting

### Prometheus Configuration

**Location**: `docker/prometheus/prometheus.yml`

Scrape Targets:
- Document Manager application metrics (`:9090/metrics`)
- Mock API services health checks
- System metrics (memory, CPU, connections)
- Custom business metrics

### Grafana Dashboards

**Location**: `docker/grafana/`

Pre-configured dashboards for:
- Application Performance Monitoring
- API Response Times and Error Rates
- Business Metrics (document operations, user actions)
- System Resource Utilization
- Health Check Status Overview

### Alert Rules

Configurable alerting for:
- High error rates (>5% for 5 minutes)
- Slow response times (>2s average)
- Memory usage exceeding 80%
- Service unavailability
- Failed health checks

## Security Considerations

### Application Security
- Input sanitization enabled by default
- Rate limiting for API endpoints
- CORS configuration for micro frontend
- Secret management via environment variables
- Non-root container execution

### Network Security
- Internal Docker network isolation
- Service-to-service communication restrictions
- Health check endpoint protection
- Metrics endpoint access control

### Development Security
- No secrets in version control
- Secure defaults in configuration
- Development/production environment separation
- Audit logging for security events

## Operational Procedures

### Starting the Application

#### Development Mode
```bash
# Quick start
npm run setup
npm run dev

# With Docker
npm run docker:up
```

#### Production Mode
```bash
# Build and deploy
./scripts/deploy.sh deploy

# With specific environment
ENVIRONMENT=production ./scripts/deploy.sh deploy
```

### Monitoring Operations

#### Viewing Logs
```bash
# Application logs
npm run docker:logs document-manager

# All service logs
npm run docker:logs

# Follow logs in real-time
./scripts/dev.sh logs
```

#### Health Checks
```bash
# Manual health check
./scripts/dev.sh health

# Automated monitoring
curl http://localhost:3000/health
```

#### Metrics Access
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin)
- **Application Metrics**: http://localhost:9090/metrics

### Troubleshooting

#### Common Issues
1. **Port Conflicts**: Check if ports 3000, 8001-8003, 9090-9091 are available
2. **Docker Issues**: Ensure Docker is running and has sufficient resources
3. **Permission Issues**: Verify script execution permissions
4. **Environment Issues**: Check .env file configuration

#### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable tracing
ENABLE_TRACING=true npm run dev
```

## Performance Optimization

### Build Optimization
- TypeScript compilation with Vite
- Tree shaking for minimal bundle size
- Multi-stage Docker builds
- Production asset optimization

### Runtime Optimization
- Metrics collection optimization
- Health check interval tuning
- Cache configuration for Redis
- Connection pooling for APIs

### Monitoring Performance
- Request duration tracking
- Memory usage monitoring
- API response time analysis
- Error rate tracking

## Maintenance & Updates

### Regular Maintenance Tasks
1. **Security Updates**: Regularly update dependencies
2. **Log Rotation**: Configure log file rotation
3. **Metrics Cleanup**: Prune old metrics data
4. **Health Check Review**: Validate health check accuracy
5. **Performance Review**: Analyze metrics for optimization opportunities

### Update Procedures
1. **Dependencies**: Use `npm audit` and `npm update`
2. **Docker Images**: Regular base image updates
3. **Configuration**: Review and update configuration as needed
4. **Documentation**: Keep infrastructure documentation current

---

*Last updated: 2025-09-18*
*Status: Production-ready infrastructure complete*