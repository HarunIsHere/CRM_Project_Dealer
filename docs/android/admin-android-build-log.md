# Admin Android Build Log

## Phase 1 - Skeleton

Created app path:

    apps/admin-android

Included:

- Kotlin Android project skeleton
- Jetpack Compose
- Retrofit API client
- kotlinx.serialization response models
- DataStore token storage
- Login screen
- Dashboard screen
- Session restore
- Logout action

Backend base URL:

    https://crm.ayartuerk.me/api/v1

Next:

- Open in Android Studio
- Sync Gradle
- Run app
- Test login against production backend

## Phase 1.3 - JVM target build fix

Result:

- Set Java sourceCompatibility to 17
- Set Java targetCompatibility to 17
- Set Kotlin jvmTarget to 17
- compileDebugKotlin passed locally
