<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Superset Fork

Apache Superset `4.1.4` fork with custom `Pivot Table V2` behavior and isolated local dev stack on `http://localhost:18088`.

Use this README as quick map: what to rebuild, restart, and verify after each kind of change. Deep details live in linked docs.

## Key Docs

| Document | Use when |
| --- | --- |
| [`docker/README.dev.md`](docker/README.dev.md) | Need local dev stack, logs, reset, troubleshooting |
| [`START_SUPERSET.md`](START_SUPERSET.md) | Need step-by-step local start on `18088` |
| [`REBUILD_DOCKER_IMAGE.md`](REBUILD_DOCKER_IMAGE.md) | Need image rebuild flow tied to CI/CD |
| [`PRD.md`](PRD.md) | Need fork feature context or status |
| [`superset-frontend/plugins/plugin-chart-pivot-table-v2/`](superset-frontend/plugins/plugin-chart-pivot-table-v2/) | Need plugin source |

## Change -> Required Actions

| If you changed | Do before test deploy or handoff |
| --- | --- |
| Frontend or plugin code in `superset-frontend/` | Run `npm run plugins:build` and `npm run build`, then restart or rebuild dev container. Verify UI on `http://localhost:18088`. |
| Backend Python code in `superset/` | Rebuild or restart dev container. If schema did not change, restart may be enough. Verify app starts and login works. |
| Docker files or dev config like `docker-compose.dev.yml` or `superset_config_dev.py` | Rebuild dev container with `docker compose -f docker/docker-compose.dev.yml up -d --build`. Verify container status and runtime env. |
| DB schema or migration code | Rebuild or restart container, then run `docker compose -f docker/docker-compose.dev.yml exec superset_dev superset db upgrade`. Verify app starts after upgrade. |
| Docs only | No deploy action required. |

## Common Procedures

### Rebuild frontend assets

```bash
cd superset-frontend
npm run plugins:build
npm run build
```

### Rebuild or restart local dev stack

```bash
docker compose -f docker/docker-compose.dev.yml up -d --build
```

If image rebuild is not needed and only app restart is needed:

```bash
docker compose -f docker/docker-compose.dev.yml restart superset_dev
```

### Initialize or upgrade local metadata DB

```bash
docker compose -f docker/docker-compose.dev.yml exec superset_dev superset db upgrade
docker compose -f docker/docker-compose.dev.yml exec superset_dev superset init
```

Run `superset init` on first start or when local setup needs re-initialization.

### Check running version or env

```bash
docker compose -f docker/docker-compose.dev.yml exec superset_dev printenv SUPERSET_VERSION
docker compose -f docker/docker-compose.dev.yml ps
```

If your change is shipped as fork build artifact, keep versioning aligned with current project practice before handing build to others.

## Verification Checklist

- Open `http://localhost:18088`
- Login with `admin` / `admin` in local dev stack
- If UI changed, verify target screen or chart behavior in browser
- If config or build changed, verify container is running and `SUPERSET_VERSION` is what you expect
- If migration changed, verify app starts after `superset db upgrade`

Useful debug pages already used in this fork:

- Explore page: `http://localhost:18088/explore/?form_data_key=v56qw5jg_sY&dashboard_page_id=n1VbmsWxakwba3O0a9bhN&slice_id=166`
- Dashboard: `http://localhost:18088/superset/dashboard/16/`

## Local Dev Stack

- Superset: `18088`
- Postgres: `15432`
- Redis: `16379`

Primary local entrypoint:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

For logs:

```bash
docker compose -f docker/docker-compose.dev.yml logs -f superset_dev
```

## Notes For Fork Changes

- `Pivot Table V2` is main customized area in this fork.
- Frontend changes can require both asset rebuild and app restart before browser shows correct files.
- Do not invent production deploy steps from this README. If prod flow matters, use project CI/CD and image docs first.

## Upstream Superset

Need general Superset documentation instead of fork procedure?

- [Official docs](https://superset.apache.org)
- [Installation and configuration](https://superset.apache.org/docs/installation/architecture/)
- [Contributor guide](https://github.com/apache/superset/blob/master/CONTRIBUTING.md)
- [REST API](https://superset.apache.org/docs/rest-api)
