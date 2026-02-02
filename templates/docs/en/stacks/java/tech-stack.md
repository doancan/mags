---
title: "{{project_name}}: Tech Stack (Java)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, tech-stack, java]
---

# Tech Stack

## Summary

> Brief summary of the tech stack and key architectural decisions.

## Runtime

| Component | Choice | Version | Notes |
|-----------|--------|---------|-------|
| Language | Java | 17+ (LTS) | Options: 17, 21 (LTS) |
| Build Tool | {{build_tool}} | Latest | Options: Maven, Gradle |
| JDK Vendor | {{jdk_vendor}} | Latest | Options: Eclipse Temurin, Amazon Corretto, GraalVM |

## Core Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Application Framework | Spring Boot | {{spring_boot_version}} (3.x) |
| Web | Spring Web / WebFlux | MVC or reactive |
| Security | Spring Security | Authentication & authorization |
| Configuration | Spring Config | `application.yml` |
| Dependency Injection | Spring IoC | Built-in |

## Database

| Component | Choice | Notes |
|-----------|--------|-------|
| Primary DB | {{database}} | Options: PostgreSQL, MySQL |
| ORM | {{orm}} | Options: JPA/Hibernate, jOOQ, MyBatis |
| Connection Pool | HikariCP | Default in Spring Boot |
| Migrations | {{migration_tool}} | Options: Flyway, Liquibase |

### ORM Comparison

| Feature | JPA/Hibernate | jOOQ | MyBatis |
|---------|--------------|------|---------|
| Approach | ORM | Type-safe SQL DSL | SQL mapper |
| Learning curve | Medium | Medium | Low |
| Type safety | Annotations | Compile-time | XML/annotations |
| Performance control | Limited | High | High |
| Best for | CRUD-heavy apps | Complex queries | Legacy DBs |

## Testing

| Component | Choice | Notes |
|-----------|--------|-------|
| Test Runner | JUnit 5 | Industry standard |
| Mocking | Mockito | Mock generation |
| Assertions | AssertJ | Fluent assertions |
| Spring Test | @SpringBootTest | Integration testing |
| Test Containers | Testcontainers | Docker-based dependencies |
| API Testing | MockMvc / WebTestClient | HTTP endpoint testing |
| Coverage | JaCoCo | Code coverage reporting |

## Code Quality

| Tool | Purpose | Configuration |
|------|---------|---------------|
| Checkstyle | Code style enforcement | `checkstyle.xml` |
| SpotBugs | Bug detection | Maven/Gradle plugin |
| PMD | Static analysis | `pmd-ruleset.xml` |
| SonarQube | Comprehensive analysis | CI pipeline |
| Lombok | Boilerplate reduction | Annotation processor |
| MapStruct | Object mapping | Compile-time mapper generation |

## Key Dependencies

| Dependency | Purpose | Group ID |
|-----------|---------|----------|
| spring-boot-starter-web | Web & REST | `org.springframework.boot` |
| spring-boot-starter-data-jpa | JPA support | `org.springframework.boot` |
| spring-boot-starter-security | Security | `org.springframework.boot` |
| spring-boot-starter-validation | Bean validation | `org.springframework.boot` |
| spring-boot-starter-actuator | Monitoring | `org.springframework.boot` |
| lombok | Boilerplate reduction | `org.projectlombok` |
| mapstruct | DTO mapping | `org.mapstruct` |
| springdoc-openapi | API documentation | `org.springdoc` |
| jjwt | JWT handling | `io.jsonwebtoken` |

## Lombok Usage

```java
@Data                    // Getters, setters, toString, equals, hashCode
@Builder                 // Builder pattern
@NoArgsConstructor       // No-args constructor
@AllArgsConstructor      // All-args constructor
@Slf4j                   // Logger field
@RequiredArgsConstructor // Constructor for final fields
```

## Build Configuration

### Maven (`pom.xml`)

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
</parent>

<properties>
    <java.version>17</java.version>
    <mapstruct.version>1.5.5.Final</mapstruct.version>
</properties>
```

### Gradle (`build.gradle.kts`)

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.2.0"
    id("io.spring.dependency-management") version "1.1.4"
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
}
```

## Environment Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `SPRING_DATASOURCE_URL` | Database JDBC URL | Yes |
| `SPRING_DATASOURCE_USERNAME` | DB username | Yes |
| `SPRING_DATASOURCE_PASSWORD` | DB password | Yes |
| `SERVER_PORT` | Server port | No (default: 8080) |
| `SPRING_PROFILES_ACTIVE` | Active profile | No (default: default) |

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |
