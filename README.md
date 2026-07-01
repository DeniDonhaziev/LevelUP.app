<div align="center">

# 🏃 LevelUp

**Фитнес-трекер нового поколения: бег, велосипед, кланы, ИИ-коуч и подсчёт калорий — в одном приложении.**

Один код — три платформы: **Web (PWA)** · **Android** · **iOS**.

[🌐 Живая версия → leveluptracker.web.app](https://leveluptracker.web.app)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-61DAFB?logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)

</div>

---

## 📖 О проекте

LevelUp — это спортивный трекер, который я собрал как полноценный продукт, а не учебный пример. Здесь есть GPS-трекинг пробежек и велозаездов с привязкой маршрута к дорогам, командные кланы с общим рейтингом и чатом, живой ИИ-коуч, который считает калории по фото еды и даёт персональные советы по анкете здоровья, а также push-уведомления, приходящие на рабочий стол даже при закрытой вкладке — как в мессенджере.

Приложение написано на **едином кодовой базе** (Expo + React Native) и работает сразу как **прогрессивное веб-приложение (PWA)**, **Android APK** и **iOS**.

---

## ✨ Возможности

### 🏃 Трекинг активности
- GPS-трекинг **бега** и **велосипеда** в реальном времени.
- Привязка маршрута к дорогам через **OSRM** (профили `foot` / `bike`).
- Умная фильтрация GPS-точек (отсев выбросов по скорости и «прыжкам»), Wake Lock, чтобы экран не гас на тренировке.
- Отдельные рейтинги для бегунов и велосипедистов, суммарная дистанция, км кланов.
- Карта на тайлах **CARTO Positron / OpenStreetMap**.

### 👥 Кланы
- Создание клана, вступление по коду-приглашению, эмодзи-логотип.
- Общий километраж клана, лидерборд участников, роли (владелец / мотиватор / участник).
- Живой **чат клана** с push-уведомлениями о новых сообщениях.
- Самоисцеление счётчика участников и мгновенное удаление клана у всех при удалении.

### 🤖 ИИ-коуч и калории
- Чат с ИИ (как в ChatGPT): история диалогов, новый чат, переключение, удаление.
- Персонализация по **анкете здоровья**: пол, возраст, рост, вес, цели, ограничения. Коуч видит динамику веса («вижу, у вас есть результат — вы сбросили 3 кг»).
- **Подсчёт калорий по фото или описанию блюда** → ккал и БЖУ с методикой (разбор на продукты, граммы, справочные значения).
- **Журнал калорий**: приёмы пищи сохраняются, дневной итог по ккал, удаление записей.
- ИИ обращается к пользователю по имени и здоровается «С возвращением».

### 📋 Онбординг и профиль
- Многошаговая анкета (7 шагов) с адаптацией под ПК, редактируемая из профиля.
- Смена имени и аватара, статистика профиля, геолокация по кнопке.
- Тёмная тема с лаймовым акцентом, аккуратные карточки-«боксы».

### 🔔 Уведомления
- Push через **Firebase Cloud Messaging** — доставка на рабочий стол установленного PWA.
- Тонкая настройка категорий (цели, привычки, серии, пробежки, ИИ, клубы, мотивация).

### 🛡️ Админ-панель
- Доступ только у администратора: удаление кланов и сообщений, кик участников, удаление строк в рейтинге.
- Права закреплены в **Firestore Security Rules** на стороне сервера.

---

## 🧰 Технологии

### Языки
| Язык | Где используется |
|------|------------------|
| **TypeScript** (`.ts` / `.tsx`) | Ядро проекта: вся логика, экраны, стор, типы |
| **JavaScript** (`.js` / `.cjs`) | Скрипты сборки, деплоя и рассылки push |
| **HTML / CSS** | Веб-обёртка PWA, service worker, манифест |
| **JSON** | Конфигурация (`app.json`, `package.json`, `firestore.rules`) |
| **PowerShell** (`.ps1`) | Вспомогательные скрипты под Windows |
| **GraphQL** (`.gql`) | Схемы Firebase Data Connect |

### Стек
- **Frontend:** React Native + Expo (SDK), Expo Router (файловая маршрутизация), React Native Web.
- **State:** Zustand + `persist` (AsyncStorage) — офлайн-first, данные переживают перезагрузку.
- **UI/анимации:** react-native-reanimated, expo-linear-gradient, react-native-svg, шрифты Inter.
- **Карты/гео:** react-native-maps, expo-location, Web Geolocation API, OSRM (road-snapping).
- **Backend (BaaS):** Firebase — Firestore, Auth, Storage, Cloud Messaging, Hosting, Security Rules.
- **AI:** OpenRouter (DeepSeek Chat — текст, Gemini Vision — анализ фото еды).

### Обработка данных
- **Firestore** — облачная NoSQL-база (пользователи, кланы, чаты, рейтинги, анкеты) с realtime-подписками.
- **Zustand + AsyncStorage** — локальное состояние и офлайн-кэш.
- **Слой слияния** (`lib/userDataMerge.ts`) — объединяет локальные и облачные данные при входе.
- **Своя бизнес-логика** в `lib/` — GPS-трек, дистанции, уровни/XP, агрегация рейтингов.
- **OpenRouter AI** — «тяжёлая» обработка: еда → калории, анкета → советы.

---

## 🚀 Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Настроить окружение
cp .env.example .env
# заполнить ключи Firebase (Console → Project settings) и OpenRouter (openrouter.ai/keys)

# 3. Запустить
npm run web        # веб (PWA)
npm run android    # Android
npm run ios        # iOS
```

> `.env` в `.gitignore` — реальные ключи не попадают в репозиторий. В `.env.example` только шаблон.

---

## 📜 Полезные скрипты

| Команда | Что делает |
|---------|-----------|
| `npm run web` | Локальный запуск веб-версии |
| `npm run export:web` | Сборка PWA в `dist/` |
| `npm run deploy:hosting` | Деплой на Firebase Hosting |
| `npm run build:apk` | Сборка Android APK (EAS) |
| `npm run broadcast:push` | Рассылка push-уведомлений |
| `npm run deploy:functions` | Деплой Cloud Functions |

---

## 🗂️ Структура

```
app/            # экраны и маршруты (Expo Router)
  (tabs)/       # вкладки: главная, бег, кланы, статистика, ИИ, профиль
  (auth)/       # вход и регистрация
  onboarding.tsx, admin.tsx
components/     # переиспользуемые UI-компоненты
lib/            # бизнес-логика: firebase, ai, gps, onboarding, notifications
store/          # Zustand-стор
public/         # PWA: service worker, манифест, иконки
scripts/        # деплой, push, сборка (Node.js / PowerShell)
firestore.rules # правила доступа Firestore
```

---

## 📄 Лицензия

Проект разработан **[@DeniDonhaziev](https://github.com/DeniDonhaziev)**. Все права защищены.

<div align="center">

**Сделано с ⚡ на TypeScript + React Native**

</div>
