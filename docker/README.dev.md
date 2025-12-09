# Superset Dev Environment

This directory contains a self-contained development environment for testing the forked Superset version (`feature/mixed-chart-v2`). The dev environment is completely independent from production and allows quick iteration without affecting production systems.

## Overview

The dev environment includes:
- **Postgres** (port 15432) - Database for Superset metadata
- **Redis** (port 16379) - Cache and rate limiting
- **Superset Dev** (port 18088) - Forked Superset instance with ClickHouse and MSSQL drivers

All services run in a separate Docker network (`superset_dev_net`) and use separate data volumes to ensure complete isolation from production. The `superset_dev` container is also connected to the production network (`clhs_sandbox_click_network`) to access ClickHouse and other production services.

## Quick Start

### 1. Start the dev environment

```bash
cd /home/kobanenkokn/Superset_4.1.4_fork/docker
docker compose -f docker-compose.dev.yml up -d
```

### 2. Initialize Superset database (first time only)

```bash
# Upgrade database schema
docker compose -f docker-compose.dev.yml exec superset_dev superset db upgrade

# Initialize Superset (creates admin user)
docker compose -f docker-compose.dev.yml exec superset_dev superset init
```

**Default admin credentials:**
- Username: `admin`
- Password: `admin`

### 3. Access Superset

Open your browser: http://localhost:18088

## Workflow

### Using GitLab CI/CD Images (Recommended)

1. **Edit code** in Cursor (in `superset/` or `superset-frontend/`)
2. **Commit and push** to GitLab:
   ```bash
   git add .
   git commit -m "feat: your changes"
   git push gitlab feature/mixed-chart-v2
   ```
3. **Trigger CI/CD build** (manually in GitLab UI or wait for automatic build)
4. **Rebuild dev image** (includes ClickHouse and MSSQL drivers):
   ```bash
   cd docker
   docker compose -f docker-compose.dev.yml build superset_dev
   docker compose -f docker-compose.dev.yml up -d superset_dev
   ```

**Note:** The dev environment uses `Dockerfile-superset-dev` which extends the GitLab CI/CD image with additional drivers (ClickHouse and MSSQL). If you want to use the base image without drivers, uncomment the `image:` line and comment out the `build:` section in `docker-compose.dev.yml`.

### Using Local Build

If you want to test changes without pushing to GitLab:

1. **Edit code** in Cursor
2. **The dev environment uses `Dockerfile-superset-dev`** which includes ClickHouse and MSSQL drivers
3. **Build and start**:
   ```bash
   cd docker
   docker compose -f docker-compose.dev.yml build superset_dev
   docker compose -f docker-compose.dev.yml up -d superset_dev
   ```

**Note:** The `Dockerfile-superset-dev` extends the GitLab CI/CD dev image and adds:
- `clickhouse-connect` - ClickHouse database driver
- `pyodbc` - MSSQL/SQL Server database driver
- Microsoft ODBC Driver 17 for SQL Server

## Common Commands

### View logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Superset only
docker compose -f docker-compose.dev.yml logs -f superset_dev
```

### Stop the environment

```bash
docker compose -f docker-compose.dev.yml down
```

### Stop and remove all data (clean slate)

```bash
docker compose -f docker-compose.dev.yml down -v
```

### Restart a specific service

```bash
docker compose -f docker-compose.dev.yml restart superset_dev
```

### Execute commands in Superset container

```bash
# Open shell
docker compose -f docker-compose.dev.yml exec superset_dev bash

# Run Superset CLI commands
docker compose -f docker-compose.dev.yml exec superset_dev superset db upgrade
docker compose -f docker-compose.dev.yml exec superset_dev superset init
docker compose -f docker-compose.dev.yml exec superset_dev superset fab create-user
```

## Database Management

### Connecting to ClickHouse

The dev Superset instance can connect to the production ClickHouse database:

1. **Open Superset**: http://localhost:18088
2. **Go to**: Settings → Database Connections → + Database
3. **Select**: ClickHouse
4. **Connection settings**:
   - **Host**: `clickhouse` (container name in production network)
   - **Port**: `8123` (HTTP) or `9000` (native)
   - **Database**: Your database name
   - **Username/Password**: Your credentials

**Note**: The `superset_dev` container is connected to the `clhs_sandbox_click_network` production network, allowing it to resolve the `clickhouse` hostname.

### Access Postgres directly

```bash
docker compose -f docker-compose.dev.yml exec postgres_dev psql -U superset_dev -d superset_dev
```

### Reset database

```bash
# Stop services
docker compose -f docker-compose.dev.yml down

# Remove data volumes
rm -rf ../postgres_data_dev
rm -rf ../superset_data_dev

# Start fresh
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec superset_dev superset db upgrade
docker compose -f docker-compose.dev.yml exec superset_dev superset init
```

## Configuration

### Dev Configuration File

Edit `superset_config_dev.py` to customize dev environment settings:

- Feature flags
- Logging levels
- CORS settings
- Other Superset configuration options

Changes require restarting the Superset container:

```bash
docker compose -f docker-compose.dev.yml restart superset_dev
```

## Troubleshooting

### Port conflicts

If ports 15432, 16379, or 18088 are already in use, modify them in `docker-compose.dev.yml`:

```yaml
ports:
  - "18089:8088"  # Change host port
```

### Container won't start

Check logs:
```bash
docker compose -f docker-compose.dev.yml logs superset_dev
```

### Database connection errors

Ensure Postgres is healthy:
```bash
docker compose -f docker-compose.dev.yml ps
```

Wait for health checks to pass before starting Superset.

### Image pull errors

If you can't pull from GitLab registry:

1. **Login to GitLab registry**:
   ```bash
   docker login gitlab.gdpgroup.ru:5050
   ```

2. **Or use local build** (see "Using Local Build" section above)

### Permission errors

If you encounter permission errors with volumes:

```bash
# Fix ownership (run from project root)
sudo chown -R $USER:$USER postgres_data_dev superset_data_dev
```

## File Structure

```
Superset_4.1.4_fork/
├── docker/
│   ├── docker-compose.dev.yml      # Dev environment definition
│   ├── superset_config_dev.py     # Dev configuration
│   └── README.dev.md              # This file
├── postgres_data_dev/              # Postgres data (gitignored)
└── superset_data_dev/              # Superset data (gitignored)
```

## Integration with Cursor

1. Open `/home/kobanenkokn/Superset_4.1.4_fork` as workspace in Cursor
2. Edit code in `superset/` or `superset-frontend/`
3. Use terminal in Cursor to run docker compose commands
4. Test changes at http://localhost:18088

## Production vs Dev

| Aspect | Production | Dev |
|--------|-----------|-----|
| Location | `/home/kobanenkokn/DWH/clhs_sandbox/` | `/home/kobanenkokn/Superset_4.1.4_fork/docker/` |
| Superset Image | `apache/superset:4.1.4` | `gitlab...:feature-mixed-chart-v2-dev` |
| Port | 8088 | 18088 |
| Database | `superset` (prod) | `superset_dev` (dev) |
| Network | `click_network` | `superset_dev_net` + `clhs_sandbox_click_network` (for ClickHouse access) |
| Data | Production volumes | Dev volumes (separate) |
| ClickHouse Access | Direct | Via production network |

**Important**: Dev environment is isolated for Superset data/metadata, but connected to production network for accessing ClickHouse and other production services.

