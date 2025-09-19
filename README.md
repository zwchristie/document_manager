# Document Manager

A production-ready micro front-end application for LLM-powered documentation enrichment and RAG knowledge base ingestion with comprehensive observability and automated deployment.

## 🚀 Quick Start

### Automated Setup

#### Linux/macOS
```bash
./scripts/setup.sh
```

#### Windows
```powershell
.\scripts\setup.ps1
```

### Manual Setup

1. **Prerequisites**
   - Node.js 18+
   - npm 8+
   - Docker 20+ (optional)

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API endpoints
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 🏗️ Architecture

### Core Components

- **Document Input & Enrichment**: Natural language to structured documentation
- **Drift Detection**: Intelligent duplicate detection and content comparison
- **Micro Frontend**: Embeddable component for existing applications
- **API Integration**: LLM, Q&A, and Document services

### Infrastructure Features

- **🔧 Configuration Management**: Centralized, validated configuration with environment support
- **📊 Observability**: Structured logging, metrics collection, and health monitoring
- **🐳 Containerization**: Production-ready Docker setup with multi-stage builds
- **📈 Monitoring**: Prometheus metrics and Grafana dashboards
- **🔄 Automation**: Setup, development, and deployment scripts
- **🛡️ Security**: Input sanitization, rate limiting, and secure defaults

## 📋 Available Scripts

### Development
```bash
npm run dev              # Start development server
npm run dev:helper       # Development helper commands
npm run docker:up        # Start with Docker Compose
npm run docker:down      # Stop Docker services
```

### Testing & Quality
```bash
npm run test             # Run unit tests
npm run test:coverage    # Run tests with coverage
npm run test:ui          # Run tests with UI
npm run lint             # Run linting
npm run lint:fix         # Fix linting issues
npm run typecheck        # Run TypeScript checks
```

### Build & Deploy
```bash
npm run build            # Production build
npm run build:lib        # Library build
npm run preview          # Preview production build
npm run deploy           # Deploy application
```

### Setup & Maintenance
```bash
npm run setup            # Automated setup (Linux/macOS)
npm run setup:windows    # Automated setup (Windows)
```

## 🐳 Docker Deployment

### Development Environment
```bash
docker-compose up -d
```

### Production Environment
```bash
docker-compose -f docker-compose.yml up -d
```

### Services Included
- **Document Manager**: Main application (:3000)
- **Mock APIs**: LLM (:8001), Q&A (:8002), Document (:8003)
- **Redis**: Caching layer (:6379)
- **Prometheus**: Metrics collection (:9091)
- **Grafana**: Metrics visualization (:3001)

## 📊 Monitoring & Observability

### Health Checks
```bash
curl http://localhost:3000/health
```

### Metrics
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin)
- **Application Metrics**: http://localhost:9090/metrics

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f document-manager

# Development helper
./scripts/dev.sh logs
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

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

### Configuration Management

The application uses a centralized configuration system with:
- Zod-based validation
- Environment-specific settings
- Type-safe configuration objects
- Hot reloading capabilities

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test -- --watch

# UI mode
npm run test:ui
```

### Test Structure
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API service testing
- **Health Checks**: System validation

## 🚀 Deployment

### Automated Deployment
```bash
# Full deployment
./scripts/deploy.sh deploy

# Build only
./scripts/deploy.sh build

# Docker deployment
ENVIRONMENT=docker ./scripts/deploy.sh deploy
```

### Environment Configuration
```bash
# Production deployment
ENVIRONMENT=production \
DOCKER_REGISTRY=your-registry.com \
TAG=v1.0.0 \
./scripts/deploy.sh deploy
```

### Rollback
```bash
ROLLBACK_TAG=v0.9.0 ./scripts/deploy.sh rollback
```

## 🛠️ Development Tools

### Development Helper Script
```bash
# Start development environment
./scripts/dev.sh start

# Run tests with specific type
./scripts/dev.sh test coverage

# Lint and fix issues
./scripts/dev.sh lint fix

# Health check
./scripts/dev.sh health

# Environment status
./scripts/dev.sh status

# Clean and reset
./scripts/dev.sh reset
```

### Available Commands
- `start` - Start development environment
- `stop` - Stop development environment
- `restart` - Restart development environment
- `logs [service]` - View logs
- `test [type]` - Run tests
- `lint [mode]` - Run linting
- `typecheck` - TypeScript checking
- `build [type]` - Build application
- `clean` - Clean artifacts
- `reset` - Reset environment
- `health` - Health check
- `status` - Environment status

## 🔍 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check port usage
   lsof -i :3000
   ```

2. **Docker Issues**
   ```bash
   # Check Docker status
   docker info

   # Reset Docker environment
   docker-compose down -v
   ```

3. **Permission Issues**
   ```bash
   # Fix script permissions
   chmod +x scripts/*.sh
   ```

4. **Environment Configuration**
   ```bash
   # Validate configuration
   npm run typecheck
   ```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable tracing
ENABLE_TRACING=true npm run dev
```

## 📚 Documentation

- **[Project Overview](./dev-context/project-overview.md)**: Comprehensive project documentation
- **[Architecture Design](./dev-context/architecture-design.md)**: Technical architecture details
- **[Infrastructure Setup](./dev-context/infrastructure-setup.md)**: Infrastructure and DevOps documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests and linting
4. Submit a pull request

### Development Workflow
```bash
# Setup development environment
./scripts/setup.sh

# Start development
./scripts/dev.sh start

# Run quality checks
./scripts/dev.sh test
./scripts/dev.sh lint
./scripts/dev.sh typecheck

# Health check before commit
./scripts/dev.sh health
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository**: [GitHub](https://github.com/your-company/document-manager)
- **Issues**: [GitHub Issues](https://github.com/your-company/document-manager/issues)
- **Documentation**: [Wiki](https://github.com/your-company/document-manager/wiki)

---

**Document Manager** - Making documentation creation frictionless for developers with LLM-powered enrichment and intelligent drift detection.