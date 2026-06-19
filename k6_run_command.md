```cd /d/HHTL/ChatRealTime

docker compose -f docker-compose.redis.yml up -d
```
```docker ps
CONTAINER ID   IMAGE                  COMMAND                  CREATED        STATUS                        PORTS                                         NAMES
9b49f89f1159   redis:7-alpine         "docker-entrypoint.s…"   3 days ago     Up About a minute (healthy)   0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp   chat-realtime-redis
028a1f1dcd30   mysql:latest           "docker-entrypoint.s…"   2 months ago   Up 3 minutes                  0.0.0.0:3309->3306/tcp, [::]:3309->3306/tcp   mysql_container
2af6c20dc7ad   postgres:14.1-alpine   "docker-entrypoint.s…"   2 months ago   Up 3 minutes                  0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp   postgres_container
```
```
$ export NODE_ENV=development
export LOAD_TEST=true
export DISABLE_EMAIL=true

export REDIS_ENABLED=true
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_KEY_PREFIX=chatrt:k6
export CACHE_ENABLED=true

export AUTH_USER_LOOKUP_CACHE_ENABLED=true
export AUTH_USER_LOOKUP_CACHE_TTL_SECONDS=300

export MAINTENANCE_L1_CACHE_ENABLED=true
export MAINTENANCE_L1_CACHE_TTL_MS=30000
export MAINTENANCE_CACHE_TTL_SECONDS=300

npm run start:cluster 2>&1 | tee ../backend-k6-cluster.log

> backend@1.0.0 start:cluster
> node src/cluster-server.js

[dotenv@17.2.3] injecting env (17) from .env -- tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] }
[Cluster] Primary started { pid: 13676, workers: 4 }
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops
[Cluster] Worker starting { workerId: 4, pid: 26204 }
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild
[Cluster] Worker starting { workerId: 1, pid: 31700 }
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild
[Cluster] Worker starting { workerId: 2, pid: 31196 }
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
[Cluster] Worker starting { workerId: 3, pid: 24620 }
[MongoDB] Pool config: {
  maxPoolSize: 'default',
  minPoolSize: 'default',
  serverSelectionTimeoutMS: 'default',
  socketTimeoutMS: 'default',
  monitorCommands: false
}
Liên kết dữ liệu thành công!
[Redis] Client created for 127.0.0.1:6379/0
[Redis] Connecting
[Redis] Ready
[SocketRedisAdapter] Disabled
[SMTP] Email sending is disabled for load test mode.
Server bắt đầu chạy trên cổng 5001
[MongoDB] Pool config: {
  maxPoolSize: 'default',
  minPoolSize: 'default',
  serverSelectionTimeoutMS: 'default',
  socketTimeoutMS: 'default',
  monitorCommands: false
}
Liên kết dữ liệu thành công!
[MongoDB] Pool config: {
  maxPoolSize: 'default',
  minPoolSize: 'default',
  serverSelectionTimeoutMS: 'default',
  socketTimeoutMS: 'default',
  monitorCommands: false
}
Liên kết dữ liệu thành công!
[Redis] Client created for 127.0.0.1:6379/0
[Redis] Client created for 127.0.0.1:6379/0
[Redis] Connecting
[Redis] Connecting
[Redis] Ready
[Redis] Ready
[SocketRedisAdapter] Disabled
[SocketRedisAdapter] Disabled
[SMTP] Email sending is disabled for load test mode.
[SMTP] Email sending is disabled for load test mode.
Server bắt đầu chạy trên cổng 5001
Server bắt đầu chạy trên cổng 5001
[MongoDB] Pool config: {
  maxPoolSize: 'default',
  minPoolSize: 'default',
  serverSelectionTimeoutMS: 'default',
  socketTimeoutMS: 'default',
  monitorCommands: false
}
Liên kết dữ liệu thành công!
[Redis] Client created for 127.0.0.1:6379/0
[Redis] Connecting
[Redis] Ready
[SocketRedisAdapter] Disabled
[SMTP] Email sending is disabled for load test mode.
Server bắt đầu chạy trên cổng 5001

```
```Lệnh chạy k6 test Load
cd /d/HHTL/ChatRealTime

mkdir -p k6-results

for VUS in 25 50 100 200 400 500
do
  echo "=============================="
  echo "Running login test: ${VUS} VUs"
  echo "=============================="

  k6 run \
    -e BASE_URL="http://127.0.0.1:5001" \
    -e TEST_USERNAME="vanh" \
    -e TEST_PASSWORD="1234567" \
    -e MODE="valid" \
    -e VUS="$VUS" \
    --summary-export "k6-results/login-compare-${VUS}vus-summary.json" \
    tests/load/login-compare-test.js \
    2>&1 | tee "k6-results/login-compare-${VUS}vus.log"

  sleep 20
done
```

```xem nhanh kết quả

cd /d/HHTL/ChatRealTime

grep -E "http_req_duration|http_req_failed|checks|iterations" k6-results/login-compare-*.log
```

