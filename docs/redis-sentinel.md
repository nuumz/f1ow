# Redis Sentinel Configuration Guide

This guide explains how to configure Redis Sentinel support in the Workflow Engine.

## Overview

Redis Sentinel provides high availability for Redis by monitoring master and slave instances and performing automatic failover when needed. The Workflow Engine supports both standard Redis and Redis Sentinel configurations.

## Configuration

### Standard Redis (Default)

```bash
# .env file
REDIS_URL=redis://localhost:6379
```

### Redis Sentinel

```bash
# .env file
REDIS_URL=redis-sentinel://host1:26379,host2:26379,host3:26379/mymaster?db=0&password=pass
```

## Redis Sentinel URL Format

The Redis Sentinel URL follows this format:

```
redis-sentinel://[password@]host:port,host:port,host:port/master-name[?query]
```

### Components:

- **`redis-sentinel://`** - Protocol prefix to indicate Sentinel mode
- **`password@`** - Optional Redis password for master/slave instances
- **`host:port,host:port`** - Comma-separated list of Sentinel addresses
- **`master-name`** - Name of the Redis master (default: "mymaster")
- **Query parameters:**
  - `db=N` - Redis database number (default: 0)
  - `password=xxx` - Password for Sentinel instances (if different from Redis password)

## Examples

### Basic Sentinel Setup

```bash
# Three Sentinel instances monitoring master "mymaster"
REDIS_URL=redis-sentinel://192.168.1.10:26379,192.168.1.11:26379,192.168.1.12:26379/mymaster
```

### Sentinel with Authentication

```bash
# Redis password + different Sentinel password
REDIS_URL=redis-sentinel://redispass@192.168.1.10:26379,192.168.1.11:26379,192.168.1.12:26379/mymaster?password=sentinelpass
```

### Sentinel with Database Selection

```bash
# Use database 1 instead of default database 0
REDIS_URL=redis-sentinel://192.168.1.10:26379,192.168.1.11:26379,192.168.1.12:26379/mymaster?db=1
```

### Full Configuration

```bash
# Complete setup with all options
REDIS_URL=redis-sentinel://redispass@192.168.1.10:26379,192.168.1.11:26379,192.168.1.12:26379/production-master?db=2&password=sentinelpass
```

## Docker Compose Example

### Standard Redis

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Redis with Sentinel

```yaml
# docker-compose.sentinel.yml
services:
  redis-master:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass mypassword

  redis-slave:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --slaveof redis-master 6379 --masterauth mypassword --requirepass mypassword
    depends_on:
      - redis-master

  redis-sentinel-1:
    image: redis:7-alpine
    ports:
      - "26379:26379"
    command: >
      bash -c "echo 'port 26379
      sentinel monitor mymaster redis-master 6379 2
      sentinel auth-pass mymaster mypassword
      sentinel down-after-milliseconds mymaster 5000
      sentinel failover-timeout mymaster 60000
      sentinel parallel-syncs mymaster 1' > /etc/redis-sentinel.conf &&
      redis-sentinel /etc/redis-sentinel.conf"
    depends_on:
      - redis-master

  redis-sentinel-2:
    image: redis:7-alpine
    ports:
      - "26380:26379"
    command: >
      bash -c "echo 'port 26379
      sentinel monitor mymaster redis-master 6379 2
      sentinel auth-pass mymaster mypassword
      sentinel down-after-milliseconds mymaster 5000
      sentinel failover-timeout mymaster 60000
      sentinel parallel-syncs mymaster 1' > /etc/redis-sentinel.conf &&
      redis-sentinel /etc/redis-sentinel.conf"
    depends_on:
      - redis-master

  redis-sentinel-3:
    image: redis:7-alpine
    ports:
      - "26381:26379"
    command: >
      bash -c "echo 'port 26379
      sentinel monitor mymaster redis-master 6379 2
      sentinel auth-pass mymaster mypassword
      sentinel down-after-milliseconds mymaster 5000
      sentinel failover-timeout mymaster 60000
      sentinel parallel-syncs mymaster 1' > /etc/redis-sentinel.conf &&
      redis-sentinel /etc/redis-sentinel.conf"
    depends_on:
      - redis-master
```

## Testing Sentinel Configuration

### 1. Start Sentinel Setup

```bash
# Start Redis Sentinel cluster
docker-compose -f docker-compose.sentinel.yml up -d

# Wait for services to start
sleep 10
```

### 2. Configure Application

```bash
# Update .env file
REDIS_URL=redis-sentinel://mypassword@localhost:26379,localhost:26380,localhost:26381/mymaster
```

### 3. Test Connection

```bash
# Start the workflow engine
make run

# Should see logs like:
# "Successfully connected to Redis via Sentinel"
# "Master: localhost:6379"
```

### 4. Test Failover

```bash
# Simulate master failure
docker stop redis-master

# Check logs - should see automatic failover
# New master should be selected automatically
```

## Production Considerations

### High Availability Setup

1. **Use odd number of Sentinels** (3, 5, 7) to avoid split-brain scenarios
2. **Deploy Sentinels on different hosts** than Redis instances
3. **Configure appropriate timeouts:**
   - `down-after-milliseconds`: 30000 (30s)
   - `failover-timeout`: 180000 (3min)
   - `parallel-syncs`: 1 (conservative)

### Monitoring

```bash
# Check Sentinel status
redis-cli -h localhost -p 26379 SENTINEL masters
redis-cli -h localhost -p 26379 SENTINEL slaves mymaster
redis-cli -h localhost -p 26379 SENTINEL sentinels mymaster
```

### Security

1. **Use authentication** for both Redis and Sentinel
2. **Isolate network access** to Sentinel ports
3. **Use TLS** in production environments
4. **Rotate passwords** regularly

## Troubleshooting

### Common Issues

1. **Connection refused**
   ```bash
   # Check if Sentinels are running
   docker ps | grep sentinel
   
   # Check Sentinel logs
   docker logs redis-sentinel-1
   ```

2. **Authentication failed**
   ```bash
   # Verify passwords match
   redis-cli -h localhost -p 6379 -a mypassword ping
   redis-cli -h localhost -p 26379 SENTINEL masters
   ```

3. **Master not found**
   ```bash
   # Check master name
   redis-cli -h localhost -p 26379 SENTINEL masters
   
   # Verify master name in URL matches Sentinel configuration
   ```

### Debug Logging

Enable debug logging to see detailed connection information:

```bash
# .env file
DEBUG=true
LOG_LEVEL=debug
```

This will show detailed Redis connection logs including:
- Sentinel discovery process
- Master selection
- Failover events
- Connection retries

## Environment Variables Summary

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDIS_URL` (Sentinel) | Sentinel connection string | `redis-sentinel://host:26379/master` |
| `DEBUG` | Enable debug logging | `true` |
| `LOG_LEVEL` | Logging level | `debug`, `info`, `warn`, `error` |

## Migration from Standard Redis

1. **Set up Sentinel cluster** alongside existing Redis
2. **Test Sentinel configuration** in staging environment
3. **Update connection string** in production
4. **Monitor failover behavior** and adjust timeouts as needed
5. **Remove standalone Redis** once Sentinel is stable
