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

# README Deploy Procedures Design

## Goal

Update root `README.md` so it helps both developers and operators quickly decide which rebuild, restart, or verification steps are required after a given type of change.

The document should stay concise, prefer procedures over description, and avoid unverified deployment details.

## Audience

- Developers testing changes locally in fork dev stack on `http://localhost:18088`
- Operators or maintainers who need a short deploy-oriented map before reading detailed docs

## Scope

In scope:

- Rewrite top portion of `README.md`
- Emphasize change-type-to-procedure mapping
- Link to detailed repo docs for dev environment and image rebuild flow
- Keep a short upstream Superset section with essential links only

Out of scope:

- Full production deployment runbook
- CI/CD redesign
- Detailed troubleshooting beyond a few high-signal pointers
- Editing linked deep-dive docs unless needed for consistency

## Recommended Structure

`README.md` should use hybrid structure:

1. Short fork summary
2. Change-type to required-actions matrix
3. Common procedures
4. Verification checklist
5. Links to detailed docs
6. Short upstream Superset section

## Content Rules

- Keep top operator-focused section compact
- Use tables and short checklists instead of long prose
- State only repo-backed procedures
- When production details are uncertain, point to project-specific deploy or CI documentation instead of inventing commands

## Planned Sections

### 1. Fork Summary

Very short summary covering:

- This repository is a Superset `4.1.4` fork
- Main custom area is `Pivot Table V2`
- Main local test target is `localhost:18088`

### 2. Change Matrix

Main section. Each row maps change type to required actions before test deploy or handoff.

Expected rows:

| Change type | Required actions |
| --- | --- |
| Frontend or plugin code | Build plugins, build frontend, restart or rebuild dev container, verify UI on `18088` |
| Backend Python code | Rebuild or restart dev container, run DB upgrade only if schema changed |
| Docker or config changes | Rebuild container, restart stack, verify runtime env/version |
| DB schema or migration changes | Run upgrade in container, verify app starts and login works |
| Docs only | No deploy action |

Version bump note:

- When shipping plugin or test build changes for this fork, mention version bump requirement for fork/plugin build artifacts only if it is already part of current repo practice

## 3. Common Procedures

Small set of reusable command groups:

- Start or rebuild dev stack
- Frontend rebuild sequence
- Container restart
- Version check from running container

Commands should point to existing repo workflows such as `docker/docker-compose.dev.yml`, `npm run plugins:build`, and `npm run build`.

## 4. Verification

Short checklist:

- Open `http://localhost:18088`
- Login with `admin/admin` when using local dev stack
- Check target chart or debug page if feature work is UI-related
- Verify runtime version or env when build/config changed

## 5. Linked Docs

README should link out to:

- `docker/README.dev.md`
- `START_SUPERSET.md`
- `REBUILD_DOCKER_IMAGE.md`

## 6. Upstream Section

Trim existing upstream README content heavily. Keep only few links:

- Official Superset docs
- Installation/configuration
- Contributing guide

Large marketing sections, screenshots, and long database/support lists should not dominate root README for this fork.

## Risks and Mitigations

- Risk: README overstates production process.
  - Mitigation: use verified repo commands only; defer uncertain prod details to linked docs.
- Risk: README becomes too long again.
  - Mitigation: keep deep detail out of root file.
- Risk: local dev and release flows get mixed.
  - Mitigation: label test-deploy versus broader rebuild guidance clearly.

## Testing Approach

No code-path testing required for README-only change.

Validation for this task:

- Read rendered markdown for clarity
- Check commands and paths against repo files
- Confirm linked docs exist
