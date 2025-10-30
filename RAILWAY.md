# Railway Deployment Guide

## 🚀 Развертывание на Railway

### Предварительные требования

1. **Установите Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Войдите в Railway:**
   ```bash
   railway login
   ```

### Шаги развертывания

#### 1. Подготовка проекта

```bash
# Соберите проект
npm run build

# Проверьте локально
npm start
```

#### 2. Создание Railway проекта

```bash
# Инициализируйте Railway проект
railway init

# Создайте новый проект
railway new
```

#### 3. Настройка переменных окружения

**Обязательные переменные:**

```bash
# FatSecret API учетные данные
railway variables set CLIENT_ID=your_fatsecret_client_id
railway variables set CLIENT_SECRET=your_fatsecret_client_secret

# Среда выполнения
railway variables set NODE_ENV=production
```

**Рекомендуемые для безопасности:**

```bash
# Токен авторизации для Poke (рекомендуется)
railway variables set MCP_AUTH_TOKEN=your_secure_auth_token_here
```

**Опциональные переменные:**

```bash
# Порт (по умолчанию 3000)
railway variables set PORT=3000

# Переопределение пути к конфигурационному файлу
railway variables set CONFIG_PATH=/tmp/fatsecret-nutrition-config.json
```

**Через Railway Dashboard:**
1. Перейдите в ваш проект → Settings → Variables
2. Добавьте обязательные переменные:
   - `CLIENT_ID`: Ваш FatSecret Client ID
   - `CLIENT_SECRET`: Ваш FatSecret Client Secret
   - `NODE_ENV`: `production`
3. Добавьте для безопасности:
   - `MCP_AUTH_TOKEN`: Случайный токен для авторизации (рекомендуется)
4. Опционально:
   - `PORT`: `3000` (обычно устанавливается автоматически)
   - `CONFIG_PATH`: `/tmp/fatsecret-nutrition-config.json`

**⚠️ Важно:** 
- `CLIENT_ID` и `CLIENT_SECRET` должны быть получены из [FatSecret Platform](https://platform.fatsecret.com/)
- `MCP_AUTH_TOKEN` должен быть сложным и уникальным токеном
- **Генерация токена:** `openssl rand -hex 32` или `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### 4. Развертывание

```bash
# Разверните проект
npm run railway:deploy

# Следите за логами
npm run railway:logs
```

### 🌐 Доступные эндпоинты

После развертывания ваш MCP сервер будет доступен по адресу:

- **Основной эндпоинт:** `https://your-app.railway.app/sse`
- **Health check:** `https://your-app.railway.app/health`

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
# Обязательные переменные
railway variables set CLIENT_ID=your_fatsecret_client_id
railway variables set CLIENT_SECRET=your_fatsecret_client_secret
railway variables set NODE_ENV=production

# Для безопасности (рекомендуется)
railway variables set MCP_AUTH_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### 🔧 Конфигурация для Poke

В **Poke → Settings → Integrations** добавьте:

**Базовый URL:**
```
https://your-app.railway.app/sse
```

**С токеном авторизации (рекомендуется):**
```
https://your-app.railway.app/sse
```
И установите **API Key** в настройках интеграции:
- **API Key:** ваш `MCP_AUTH_TOKEN`

**Без токена (небезопасно):**
```
https://your-app.railway.app/sse
```

**🔒 Рекомендация:** Всегда используйте `MCP_AUTH_TOKEN` для production-развертываний!

### 📋 Мониторинг

#### Проверка статуса
```bash
# Просмотр логов
railway logs

# Проверка health endpoint
curl https://your-app.railway.app/health
```

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
   
   # Очистите кэш Railway
   railway rebuild
   ```

2. **Проблемы с переменными окружения:**
   ```bash
   # Проверьте переменные
   railway variables list
   
   # Обновите при необходимости
   railway variables set CLIENT_ID=new_value
   ```

3. **Timeout ошибки:**
   - Railway имеет таймаут 60 секунд для HTTP запросов
   - Убедитесь что запросы к FatSecret API выполняются быстро

#### Логирование

```bash
# Просмотр логов в реальном времени
railway logs -f

# Фильтрация логов
railway logs --grep "error"
```

### 🔄 Обновления

```bash
# Для обновления кода
git add .
git commit -m "Update"
git push

# Или принудительное обновление
railway up
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
