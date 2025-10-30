# Railway Deployment Guide

## 🚀 Развертывание на Railway

### Предварительные требования

1. **Создайте аккаунт Railway:** [railway.app](https://railway.app/)
2. **Подключите GitHub репозиторий** или создайте новый проект

### Шаги развертывания

#### 1. Подготовка проекта

```bash
# Соберите проект локально для проверки
npm run build

# Проверьте локально
npm start
```

#### 2. Создание Railway проекта

1. В Railway dashboard нажмите **New Project**
2. Выберите **Deploy from GitHub repo** или загрузите код
3. Выберите ваш репозиторий

#### 3. Настройка переменных окружения

**Обязательные переменные:**

В Railway dashboard перейдите в **Settings → Variables** и добавьте:

- `CLIENT_ID`: Ваш FatSecret Client ID
- `CLIENT_SECRET`: Ваш FatSecret Client Secret
- `NODE_ENV`: `production`

**Рекомендуемые для безопасности:**

- `MCP_AUTH_TOKEN`: Случайный токен для авторизации (рекомендуется)

**Опциональные переменные:**

- `PORT`: `3000` (обычно устанавливается автоматически)
- `CONFIG_PATH`: `/tmp/fatsecret-nutrition-config.json`

**⚠️ Важно:** 
- `CLIENT_ID` и `CLIENT_SECRET` должны быть получены из [FatSecret Platform](https://platform.fatsecret.com/)
- `MCP_AUTH_TOKEN` должен быть сложным и уникальным токеном
- **Генерация токена:** `openssl rand -hex 32` или `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### 4. Развертывание

```bash
# Commit и push изменений для автоматического развертывания
git add .
git commit -m "Deploy to Railway"
git push origin main
```

Railway автоматически определит Dockerfile и начнет сборку.

### 🌐 Доступные эндпоинты

После развертывания ваш MCP сервер будет доступен по адресу:

- **Основной MCP эндпоинт:** `https://your-app.railway.app/mcp` (Streamable HTTP POST)
- **SSE альтернатива:** `https://your-app.railway.app/sse` (Server-Sent Events)
- **Health check:** `https://your-app.railway.app/health`
- **Информация о сервере:** `https://your-app.railway.app/`

**🎯 Transport для Poke:**
- **Streamable HTTP** (POST) - основной транспорт для Poke
- **SSE** - автоматический fallback при ошибках соединения (не аутентификации)

**Рекомендация:** Используйте `/mcp` - Poke автоматически выберет правильный транспорт

## 📋 Переменные окружения (шпаргалка)

| Переменная | Обязательная | Значение | Описание |
|------------|--------------|----------|----------|
| `CLIENT_ID` | ✅ | `your_fatsecret_client_id` | FatSecret API Client ID |
| `CLIENT_SECRET` | ✅ | `your_fatsecret_client_secret` | FatSecret API Client Secret |
| `NODE_ENV` | ✅ | `production` | Режим выполнения |
| `MCP_AUTH_TOKEN` | 🔒 | `your_secure_token` | Токен для безопасного подключения |
| `PORT` | ❌ | `3000` | Порт сервера |
| `CONFIG_PATH` | ❌ | `/tmp/fatsecret-nutrition-config.json` | Путь к конфигу |

**Команды для быстрой настройки:**
```bash
# Генерация токена безопасности
MCP_AUTH_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Переменные для добавления в Railway Dashboard:
# CLIENT_ID=your_fatsecret_client_id
# CLIENT_SECRET=your_fatsecret_client_secret
# NODE_ENV=production
# MCP_AUTH_TOKEN=$MCP_AUTH_TOKEN
```

### 🔧 Конфигурация для Poke

В **Poke → Settings → Integrations** добавьте:

**Основной URL (соответствует спецификации Poke):**
```
https://your-app.railway.app/mcp
```

**Transport:** Streamable HTTP (автоматически определяется Poke)

**API Key (если настроен MCP_AUTH_TOKEN):**
- Токен: `988b259bcedf57ebf75fead58f8d2dc15109489ffa9edf9658aabccc5c4877c4` (пример)
- Используйте ваш `MCP_AUTH_TOKEN` как API Key

**🔄 Процесс подключения Poke:**
1. **First attempt:** Streamable HTTP POST to `/mcp`
2. **Fallback:** SSE to `/sse` (только при ошибках соединения)
3. **Authentication:** MCP_AUTH_TOKEN требуется для обоих эндпоинтов

**🔒 Рекомендация:** Всегда используйте `MCP_AUTH_TOKEN` для production!

**📋 Поддерживаемые MCP методы:**
- `initialize` - Инициализация соединения
- `tools/list` - Список инструментов  
- `tools/call` - Вызов инструментов

### 📋 Мониторинг

#### Проверка статуса
```bash
# Проверка health endpoint
curl https://your-app.railway.app/health
```

**Мониторинг через Railway Dashboard:**
- **Logs:** View real-time logs в вашем проекте
- **Metrics:** Встроенные метрики производительности
- **Health Checks:** Автоматическая проверка каждые 30 секунд
- **Alerts:** Настройка уведомлений об ошибках

#### Метрики
- Railway предоставляет автоматический мониторинг
- Health checks каждые 30 секунд
- Автоматические перезапуски при ошибках

### 🔒 Безопасность

- Переменные окружения шифруются
- HTTPS по умолчанию
- Автоматическое обновление SSL
- Изолированная среда выполнения

### 🚨 Устранение неполадок

#### Общие проблемы

1. **Ошибка сборки:**
   ```bash
   # Проверьте локальную сборку
   npm run build
   
   # Проверьте Dockerfile
   docker build .
   ```

2. **Проблемы с переменными окружения:**
   - Проверьте переменные в Railway Dashboard → Settings → Variables
   - Убедитесь что все обязательные переменные установлены
   - Проверьте правильность значений

3. **Timeout ошибки:**
   - Railway имеет таймаут 60 секунд для HTTP запросов
   - Убедитесь что запросы к FatSecret API выполняются быстро

#### Логирование

**Просмотр логов в Railway Dashboard:**
1. Откройте ваш проект в Railway
2. Перейдите в вкладку **Logs**
3. Выберите нужный deployment для просмотра логов

**Фильтрация логов:**
- Используйте поиск в логах для фильтрации
- Ищите ошибки по ключевым словам: "error", "failed", "timeout"

### 🔄 Обновления

```bash
# Для обновления кода
git add .
git commit -m "Update"
git push

# Railway автоматически развернет изменения
```

### 📊 Масштабирование

Railway автоматически масштабирует приложение:
- **Минимум:** 1 instance
- **Максимум:** Автоматическое масштабирование
- **Load balancing:** Встроенный

### 💡 Оптимизация

1. **Кэширование:** Рассмотрите кэширование частых запросов
2. **Rate limiting:** Реализуйте на уровне приложения
3. **Monitoring:** Используйте встроенные метрики Railway

### 🆘 Поддержка

- [Railway Documentation](https://docs.railway.app/)
- [FatSecret API Docs](https://platform.fatsecret.com/docs/)
- [Poke MCP Guide](https://poke.com/docs/mcp-guide)
