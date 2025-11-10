# Быстрая инструкция по настройке GitLab Runner

## Проблема: "This job is stuck because the project doesn't have any runners online"

Эта ошибка означает, что для проекта не настроен активный GitLab Runner.

## Решение

### Шаг 1: Проверьте доступность Shared Runners

1. Перейдите в GitLab: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/settings/ci_cd`
2. Найдите раздел "Runners"
3. Если видите "Shared runners" с зеленым индикатором - включите их для проекта
4. Если shared runners недоступны - переходите к Шагу 2

### Шаг 2: Настройка собственного Runner

#### Вариант A: Установка через пакетный менеджер

```bash
# На сервере с Docker
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install gitlab-runner

# Регистрация runner
sudo gitlab-runner register
```

При регистрации введите:
- GitLab URL: `https://gitlab.gdpgroup.ru/`
- Registration token: (из Settings → CI/CD → Runners → "Set up a specific runner manually")
- Description: `docker-runner`
- Tags: (оставьте пустым или укажите `docker`)
- Executor: `docker`
- Default Docker image: `docker:24-dind`

#### Вариант B: Установка через Docker

```bash
# Запустите GitLab Runner в Docker
docker run -d --name gitlab-runner --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest

# Регистрация
docker exec -it gitlab-runner gitlab-runner register
```

### Шаг 3: Настройка конфигурации

Отредактируйте конфигурацию runner:

```bash
sudo nano /etc/gitlab-runner/config.toml
# или для Docker:
docker exec -it gitlab-runner nano /etc/gitlab-runner/config.toml
```

Добавьте или обновите секцию:

```toml
[[runners]]
  name = "docker-runner"
  url = "https://gitlab.gdpgroup.ru/"
  executor = "docker"
  [runners.docker]
    image = "docker:24-dind"
    privileged = true
    volumes = ["/cache", "/var/run/docker.sock:/var/run/docker.sock"]
```

### Шаг 4: Перезапуск Runner

```bash
# Для установки через пакетный менеджер
sudo gitlab-runner restart

# Для Docker
docker restart gitlab-runner
```

### Шаг 5: Проверка статуса

```bash
# Проверьте статус runner
sudo gitlab-runner status
# или
docker exec gitlab-runner gitlab-runner status

# Проверьте в GitLab UI:
# Settings → CI/CD → Runners
# Должен появиться активный runner с зеленым индикатором
```

## Альтернатива: Локальная сборка

Если нет возможности настроить runner, соберите образ локально:

```bash
git clone https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork.git
cd superset_4.1.4_fork
git checkout feature/mixed-chart-v2

# Соберите образ
docker build --target lean \
  -t gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2 \
  -f Dockerfile .

# Войдите в Container Registry
docker login gitlab.gdpgroup.ru:5050

# Отправьте образ
docker push gitlab.gdpgroup.ru:5050/gdpgroup/superset_4.1.4_fork:feature-mixed-chart-v2
```

## Дополнительная помощь

- Документация GitLab Runner: https://docs.gitlab.com/runner/
- Настройки проекта: `https://gitlab.gdpgroup.ru/gdpgroup/superset_4.1.4_fork/-/settings/ci_cd`
