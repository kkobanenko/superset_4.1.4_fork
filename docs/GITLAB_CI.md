# GitLab CI/CD для автоматической сборки Docker образов Superset

## Описание

Этот документ описывает настройку и использование GitLab CI/CD для автоматической сборки Docker образов Superset с поддержкой Mixed Chart 2.0.

## Требования

1. GitLab сервер с включенным Container Registry
2. GitLab Runner с поддержкой Docker (тег `docker`)
3. Ветка `feature/mixed-chart-v2` в репозитории

## Конфигурация

Файл `.gitlab-ci.yml` настроен для автоматической сборки Docker образов при пуше в ветку `feature/mixed-chart-v2`.

### Этапы сборки

1. **build-docker-lean** (автоматический)
   - Собирает production образ с таргетом `lean`
   - Запускается автоматически при каждом push в ветку
   - Создает три тега:
     - `feature-mixed-chart-v2` - основной тег ветки
     - `feature-mixed-chart-v2-latest` - последний собранный образ
     - `feature-mixed-chart-v2-<commit-sha>` - образ для конкретного коммита

2. **build-docker-dev** (ручной запуск)
   - Собирает development образ с таргетом `dev`
   - Запускается вручную через GitLab UI
   - Полезен для разработки и тестирования

## Использование в проекте "Промышленный проект"

### Шаг 1: Убедитесь, что образ собран

После push в ветку `feature/mixed-chart-v2` GitLab CI автоматически запустит сборку. Проверьте статус в GitLab:
- Перейдите: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines`
- Убедитесь, что пайплайн успешно завершился

### Шаг 2: Используйте образ в Dockerfile

В Dockerfile проекта "Промышленный проект" замените:

```dockerfile
FROM apache/superset:4.1.4
```

на:

```dockerfile
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2
```

Или используйте тег с конкретным коммитом для фиксированной версии:

```dockerfile
FROM gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-<commit-sha>
```

### Шаг 3: Аутентификация (если требуется)

Если Container Registry требует аутентификацию, выполните:

```bash
docker login gitlab.gdpgroup.ru:5050
# Введите username и password/token
```

Или используйте токен доступа:

```bash
docker login gitlab.gdpgroup.ru:5050 -u <username> -p <token>
```

## Доступные образы

После успешной сборки образы будут доступны в GitLab Container Registry:

- **Production образ (lean):**
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2`
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-latest`
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-<commit-sha>`

- **Development образ (dev):**
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-dev`
  - `gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2-dev-<commit-sha>`

## Просмотр образов в GitLab

Образы можно просмотреть в GitLab UI:
- Перейдите: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/container_registry`

## Обновление образа

При каждом новом коммите в ветку `feature/mixed-chart-v2`:
1. GitLab CI автоматически запустит сборку
2. Новый образ будет собран и отправлен в Container Registry
3. Тег `feature-mixed-chart-v2-latest` будет обновлен на новый образ

Для использования последней версии в проекте используйте тег `feature-mixed-chart-v2-latest`.

## Ручной запуск сборки

Для ручного запуска сборки dev образа:
1. Перейдите в GitLab: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/pipelines`
2. Нажмите "Run pipeline"
3. Выберите ветку `feature/mixed-chart-v2`
4. В разделе "Variables" можно настроить дополнительные параметры
5. После запуска пайплайна, job `build-docker-dev` будет доступен для ручного запуска

## Настройка GitLab Runner

### Вариант 1: Использование Shared Runners (если доступны)

Если в вашем GitLab настроены shared runners, они должны автоматически подхватить job. Проверьте настройки проекта:
- Перейдите: `Settings` → `CI/CD` → `Runners`
- Убедитесь, что "Enable shared runners for this project" включено

### Вариант 2: Настройка собственного GitLab Runner

Если shared runners недоступны, нужно настроить собственный runner:

#### Шаг 1: Установка GitLab Runner

На сервере с Docker выполните:

```bash
# Для Linux
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install gitlab-runner

# Или используйте Docker образ
docker run -d --name gitlab-runner --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest
```

#### Шаг 2: Регистрация Runner

```bash
# Получите registration token из GitLab:
# Settings → CI/CD → Runners → Expand "Set up a specific runner manually"

sudo gitlab-runner register
```

При регистрации укажите:
- GitLab URL: `https://gitlab.gdpgroup.ru/`
- Registration token: (из настроек проекта)
- Description: `docker-runner`
- Tags: `docker` (или оставьте пустым)
- Executor: `docker`
- Default Docker image: `docker:24-dind`

#### Шаг 3: Настройка конфигурации Runner

Отредактируйте `/etc/gitlab-runner/config.toml`:

```toml
[[runners]]
  name = "docker-runner"
  url = "https://gitlab.gdpgroup.ru/"
  token = "YOUR_RUNNER_TOKEN"
  executor = "docker"
  [runners.docker]
    image = "docker:24-dind"
    privileged = true
    volumes = ["/cache"]
  [runners.cache]
    [runners.cache.s3]
    # или используйте local cache
```

#### Шаг 4: Перезапуск Runner

```bash
sudo gitlab-runner restart
```

### Вариант 3: Использование Docker на локальной машине

Если нет возможности настроить runner на сервере, можно использовать локальную машину:

```bash
# Установите GitLab Runner локально
# Зарегистрируйте его как описано выше
# Runner будет работать только когда ваша машина включена
```

## Устранение проблем

### Проблема: Job застрял - нет активных runners

**Решение:**
1. **Проверьте настройки проекта:**
   - Перейдите: `Settings` → `CI/CD` → `Runners`
   - Убедитесь, что включены shared runners или настроен project runner
   - Проверьте, что runner активен (зеленый индикатор)

2. **Настройте GitLab Runner:**
   - См. раздел "Настройка GitLab Runner" выше
   - Убедитесь, что runner зарегистрирован и активен
   - Проверьте логи runner: `sudo gitlab-runner status`

3. **Альтернатива - сборка вручную:**
   - Если нет возможности настроить runner, соберите образ локально:
   ```bash
   git clone https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork.git
   cd superset_4.1.4_fork
   git checkout feature/mixed-chart-v2
   docker build --target lean -t superset-custom:feature-mixed-chart-v2 -f Dockerfile .
   ```

### Проблема: Пайплайн не запускается

**Решение:**
- Убедитесь, что файл `.gitlab-ci.yml` находится в корне репозитория
- Проверьте, что GitLab Runner активен
- Проверьте настройки CI/CD в проекте GitLab
- Убедитесь, что ветка называется точно `feature/mixed-chart-v2`

### Проблема: Ошибка при сборке образа

**Решение:**
- Проверьте логи пайплайна в GitLab
- Убедитесь, что Dockerfile корректен
- Проверьте доступность всех зависимостей

### Проблема: Не удается загрузить образ из Container Registry

**Решение:**
- Проверьте права доступа к Container Registry
- Убедитесь, что выполнен `docker login`
- Проверьте правильность URL образа

## Дополнительная информация

- Документация GitLab CI/CD: https://docs.gitlab.com/ee/ci/
- Документация Container Registry: https://docs.gitlab.com/ee/user/packages/container_registry/
- Время сборки: обычно 30-60 минут для lean образа
- Размер образа: ~1-2 GB для lean образа

