---
title: "{{project_name}}: Project Structure (Java)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, structure, java]
---

# Project Structure

## Standard Spring Boot Layout (Maven)

```
{{project_name}}/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/{{org}}/{{project_name}}/
│   │   │       ├── Application.java              # @SpringBootApplication
│   │   │       ├── config/
│   │   │       │   ├── SecurityConfig.java        # Spring Security config
│   │   │       │   ├── WebConfig.java             # CORS, interceptors
│   │   │       │   └── OpenApiConfig.java         # Swagger/OpenAPI config
│   │   │       ├── controller/
│   │   │       │   ├── UserController.java        # REST endpoints
│   │   │       │   └── HealthController.java      # Health check
│   │   │       ├── service/
│   │   │       │   ├── UserService.java           # Service interface
│   │   │       │   └── impl/
│   │   │       │       └── UserServiceImpl.java   # Service implementation
│   │   │       ├── repository/
│   │   │       │   └── UserRepository.java        # JPA repository
│   │   │       ├── model/
│   │   │       │   ├── entity/
│   │   │       │   │   ├── BaseEntity.java        # Auditing base class
│   │   │       │   │   └── User.java              # JPA entity
│   │   │       │   ├── dto/
│   │   │       │   │   ├── request/
│   │   │       │   │   │   └── CreateUserRequest.java
│   │   │       │   │   └── response/
│   │   │       │   │       └── UserResponse.java
│   │   │       │   └── mapper/
│   │   │       │       └── UserMapper.java        # MapStruct mapper
│   │   │       ├── exception/
│   │   │       │   ├── GlobalExceptionHandler.java
│   │   │       │   ├── ResourceNotFoundException.java
│   │   │       │   └── ErrorResponse.java
│   │   │       └── util/
│   │   │           └── Constants.java
│   │   └── resources/
│   │       ├── application.yml                    # Default config
│   │       ├── application-dev.yml                # Dev profile
│   │       ├── application-prod.yml               # Prod profile
│   │       ├── db/
│   │       │   └── migration/                     # Flyway migrations
│   │       │       ├── V1__create_users_table.sql
│   │       │       └── V2__add_roles_table.sql
│   │       └── static/                            # Static resources
│   └── test/
│       ├── java/
│       │   └── com/{{org}}/{{project_name}}/
│       │       ├── controller/
│       │       │   └── UserControllerTest.java    # @WebMvcTest
│       │       ├── service/
│       │       │   └── UserServiceTest.java       # Unit test
│       │       ├── repository/
│       │       │   └── UserRepositoryTest.java    # @DataJpaTest
│       │       └── integration/
│       │           └── UserIntegrationTest.java   # @SpringBootTest
│       └── resources/
│           ├── application-test.yml
│           └── data/
│               └── test-users.json
├── pom.xml                                        # Maven build
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Gradle Layout

Same source structure, but with:

```
{{project_name}}/
├── build.gradle.kts          # (or build.gradle)
├── settings.gradle.kts
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradlew
├── gradlew.bat
└── src/
    ├── main/
    └── test/
```

## Multi-Module Layout

```
{{project_name}}/
├── pom.xml                           # Parent POM
├── {{project_name}}-api/             # REST controllers, DTOs
│   ├── pom.xml
│   └── src/main/java/
├── {{project_name}}-service/         # Business logic
│   ├── pom.xml
│   └── src/main/java/
├── {{project_name}}-repository/      # Data access
│   ├── pom.xml
│   └── src/main/java/
├── {{project_name}}-model/           # Entities, domain objects
│   ├── pom.xml
│   └── src/main/java/
└── {{project_name}}-common/          # Shared utilities
    ├── pom.xml
    └── src/main/java/
```

## Package Conventions

| Package | Contents | Stereotype |
|---------|----------|-----------|
| `controller` | REST endpoints | `@RestController` |
| `service` | Business logic | `@Service` |
| `service.impl` | Service implementations | `@Service` |
| `repository` | Data access | `@Repository` |
| `model.entity` | JPA entities | `@Entity` |
| `model.dto.request` | Request DTOs | POJO / Record |
| `model.dto.response` | Response DTOs | POJO / Record |
| `model.mapper` | Object mappers | `@Mapper` (MapStruct) |
| `config` | Configuration classes | `@Configuration` |
| `exception` | Custom exceptions | `@ControllerAdvice` |
| `util` | Utilities | Static methods |

## Layer Dependencies

| Layer | May Import | Must Not Import |
|-------|-----------|----------------|
| Controller | Service, DTO, Mapper | Repository, Entity directly |
| Service | Repository, Entity, DTO | Controller |
| Repository | Entity | Service, Controller |
| DTO | (standalone) | Entity (use Mapper) |
| Mapper | Entity, DTO | Service, Repository |

## Spring Profiles

| Profile | Config File | Usage |
|---------|------------|-------|
| `default` | `application.yml` | Shared defaults |
| `dev` | `application-dev.yml` | Local development |
| `test` | `application-test.yml` | Test execution |
| `staging` | `application-staging.yml` | Staging environment |
| `prod` | `application-prod.yml` | Production |
