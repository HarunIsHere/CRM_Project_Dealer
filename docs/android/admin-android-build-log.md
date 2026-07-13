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

## Phase 2 - Navigation and V2 orders

Result:

- Added simple in-app navigation state
- Added Dashboard and Orders tabs
- Added V2 orders API endpoint
- Added V2 order detail API endpoint
- Added orders list screen
- Added order detail screen
- compileDebugKotlin passed locally

## Phase 3 - Products and categories

Result:

- Added products API endpoint
- Added product categories API endpoint
- Added repository methods
- Added Products tab
- Added category cards
- Added product cards
- compileDebugKotlin passed locally

## Phase 4.1 - Customers compile fix

Result:

- Fixed missing customer API model declarations/imports
- compileDebugKotlin passed locally

## Phase 5 - Open requests

Result:

- Added open requests API endpoint
- Added single request status mutation endpoint
- Added group-done mutation endpoint
- Added repository methods
- Added Requests tab
- Added open request cards
- Added in-progress, done, and group-done actions
- compileDebugKotlin passed locally
