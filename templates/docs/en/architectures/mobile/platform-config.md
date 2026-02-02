---
title: "{{project_name}}: Platform Configuration"
version: "0.1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, mobile, ios, android, configuration]
---

# Platform Configuration

## Overview

This document describes the platform-specific configuration for **{{project_name}}** across iOS, Android, and shared settings, including build signing, environment management, and push notification setup.

## iOS Configuration

### Info.plist

| Key | Value | Description |
|-----|-------|-------------|
| `CFBundleDisplayName` | {{project_name}} | App display name |
| `CFBundleIdentifier` | `com.example.{{project_name}}` | Bundle identifier |
| `CFBundleShortVersionString` | `1.0.0` | Marketing version |
| `CFBundleVersion` | `1` | Build number |
| `NSCameraUsageDescription` | | Camera permission prompt |
| `NSLocationWhenInUseUsageDescription` | | Location permission prompt |
| | | |

> Add all required `NS*UsageDescription` keys. Submissions will be rejected without these.

### Entitlements

| Entitlement | Enabled | Description |
|-------------|---------|-------------|
| Push Notifications | Yes / No | `aps-environment` |
| Associated Domains | Yes / No | Universal links |
| Keychain Sharing | Yes / No | Shared keychain groups |
| App Groups | Yes / No | Shared data between extensions |
| | | |

### Code Signing

| Environment | Signing Type | Provisioning Profile | Certificate |
|-------------|-------------|---------------------|-------------|
| Development | Automatic / Manual | | |
| Staging | Manual | | |
| Production | Manual | | |

## Android Configuration

### AndroidManifest.xml

| Element | Value | Description |
|---------|-------|-------------|
| `package` | `com.example.{{project_name}}` | Application ID |
| `android:versionCode` | `1` | Build number |
| `android:versionName` | `1.0.0` | Version name |
| Permissions | | Required permissions |

#### Permissions

| Permission | Required | Description |
|-----------|----------|-------------|
| `INTERNET` | Yes | Network access |
| `CAMERA` | | Camera access |
| `ACCESS_FINE_LOCATION` | | GPS location |
| | | |

### Gradle Configuration

```groovy
android {
    compileSdk 34
    defaultConfig {
        applicationId "com.example.{{project_name}}"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

### Signing Configuration

| Environment | Keystore | Key Alias | Notes |
|-------------|----------|-----------|-------|
| Debug | `debug.keystore` | `androiddebugkey` | Auto-generated |
| Staging | | | |
| Production | | | Stored in secure vault |

> Never commit keystores or signing credentials to version control.

## Shared Configuration

### App Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `APP_NAME` | {{project_name}} | Display name |
| `SUPPORT_EMAIL` | | Support contact |
| `PRIVACY_URL` | | Privacy policy link |
| `TERMS_URL` | | Terms of service link |
| | | |

### Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| | | |

## Environment Setup

### Environment Definitions

| Environment | Purpose | API Base URL | Debug | Analytics |
|-------------|---------|-------------|-------|-----------|
| Development | Local development | `http://localhost:3000` | Yes | No |
| Staging | QA and testing | `https://staging-api.example.com` | Yes | Yes |
| Production | Live users | `https://api.example.com` | No | Yes |

### Environment Variables

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| `API_URL` | | | |
| `API_KEY` | | | |
| | | | |

### Build Variants / Schemes

- **iOS**: Use Xcode schemes (Development, Staging, Production) with matching `.xcconfig` files
- **Android**: Use Gradle build flavors (`dev`, `staging`, `prod`) with matching `build.gradle` configurations

## Push Notification Setup

### iOS (APNs)

- **Authentication**: Token-based (`.p8`) / Certificate-based (`.p12`)
- **Key ID**: <!-- from Apple Developer Console -->
- **Team ID**: <!-- Apple Team ID -->
- **Bundle ID**: `com.example.{{project_name}}`
- **Environment**: Sandbox (dev) / Production

### Android (FCM)

- **Project ID**: <!-- Firebase project ID -->
- **Server Key**: <!-- stored in secrets management -->
- **google-services.json**: <!-- per environment -->

### Notification Channels (Android)

| Channel ID | Name | Importance | Sound | Vibration |
|-----------|------|------------|-------|-----------|
| `default` | General | Default | Yes | Yes |
| | | | | |

### Notification Handling

- **Foreground**: <!-- How notifications are displayed when app is active -->
- **Background**: <!-- How notifications trigger when app is backgrounded -->
- **Terminated**: <!-- How cold-start from notification is handled -->
- **Data-only**: <!-- How silent push notifications are processed -->
