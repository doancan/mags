---
title: "{{project_name}}: API Design (Java)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, java]
---

# API Design

## Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Framework | Spring Boot 3.x | Spring Web MVC |
| Serialization | Jackson | JSON de/serialization |
| Validation | Jakarta Bean Validation | `@Valid` annotations |
| Docs | springdoc-openapi | OpenAPI 3.0 generation |

## Base URL & Versioning

```
{{base_url}}/api/v1/
```

Versioning strategy: URL prefix (`/api/v1/`, `/api/v2/`).

## Endpoints

### Resource: {{resource_name}}

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/{{resource_name}}s` | List all (paginated) | {{auth}} |
| POST | `/api/v1/{{resource_name}}s` | Create new | {{auth}} |
| GET | `/api/v1/{{resource_name}}s/{id}` | Get by ID | {{auth}} |
| PUT | `/api/v1/{{resource_name}}s/{id}` | Full update | {{auth}} |
| PATCH | `/api/v1/{{resource_name}}s/{id}` | Partial update | {{auth}} |
| DELETE | `/api/v1/{{resource_name}}s/{id}` | Delete | {{auth}} |

## Controller Pattern

### @RestController

```java
@RestController
@RequestMapping("/api/v1/{{resource_name}}s")
@RequiredArgsConstructor
@Tag(name = "{{resource_name}}s", description = "{{resource_name}} management")
public class {{resource_name}}Controller {

    private final {{resource_name}}Service service;
    private final {{resource_name}}Mapper mapper;

    @GetMapping
    @Operation(summary = "List all {{resource_name}}s")
    public ResponseEntity<PagedResponse<{{resource_name}}Response>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<{{resource_name}}> result = service.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(mapper.toPagedResponse(result));
    }

    @PostMapping
    @Operation(summary = "Create a new {{resource_name}}")
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<{{resource_name}}Response> create(
            @Valid @RequestBody Create{{resource_name}}Request request) {
        {{resource_name}} entity = service.create(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(mapper.toResponse(entity));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get {{resource_name}} by ID")
    public ResponseEntity<{{resource_name}}Response> getById(
            @PathVariable Long id) {
        {{resource_name}} entity = service.findById(id);
        return ResponseEntity.ok(mapper.toResponse(entity));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update {{resource_name}}")
    public ResponseEntity<{{resource_name}}Response> update(
            @PathVariable Long id,
            @Valid @RequestBody Update{{resource_name}}Request request) {
        {{resource_name}} entity = service.update(id, request);
        return ResponseEntity.ok(mapper.toResponse(entity));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete {{resource_name}}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

## DTOs

### Request DTOs

```java
// Using records (Java 17+)
public record Create{{resource_name}}Request(
    @NotBlank @Size(max = 255)
    String name,

    @Size(max = 1000)
    String description
) {}

public record Update{{resource_name}}Request(
    @Size(max = 255)
    String name,

    @Size(max = 1000)
    String description
) {}
```

### Response DTOs

```java
public record {{resource_name}}Response(
    Long id,
    String name,
    String description,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}

public record PagedResponse<T>(
    List<T> items,
    long totalElements,
    int totalPages,
    int page,
    int size
) {}
```

## Validation

### Jakarta Bean Validation Annotations

| Annotation | Purpose | Example |
|-----------|---------|---------|
| `@NotNull` | Not null | `@NotNull Long id` |
| `@NotBlank` | Not null/empty/blank | `@NotBlank String name` |
| `@Size` | String/collection size | `@Size(min=1, max=255)` |
| `@Email` | Email format | `@Email String email` |
| `@Min` / `@Max` | Numeric range | `@Min(0) Integer age` |
| `@Pattern` | Regex pattern | `@Pattern(regexp="...")` |
| `@Valid` | Nested validation | `@Valid Address address` |

### Custom Validator

```java
@Constraint(validatedBy = UniqueEmailValidator.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface UniqueEmail {
    String message() default "Email already exists";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

## Exception Handling

### Global Exception Handler

```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(ResourceNotFoundException ex) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        List<FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> new FieldError(f.getField(), f.getDefaultMessage()))
                .toList();
        return new ErrorResponse("VALIDATION_ERROR", "Validation failed", errors);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleConflict(DataIntegrityViolationException ex) {
        return new ErrorResponse("CONFLICT", "Resource already exists");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred");
    }
}
```

### Error Response

```java
public record ErrorResponse(
    String code,
    String message,
    List<FieldError> errors
) {
    public ErrorResponse(String code, String message) {
        this(code, message, List.of());
    }
}

public record FieldError(
    String field,
    String message
) {}
```

## OpenAPI Annotations

| Annotation | Level | Purpose |
|-----------|-------|---------|
| `@Tag` | Class | Group endpoints |
| `@Operation` | Method | Describe endpoint |
| `@ApiResponse` | Method | Document responses |
| `@Parameter` | Parameter | Describe parameters |
| `@Schema` | Field/Class | Describe schema |

```java
@Operation(
    summary = "Create a new user",
    responses = {
        @ApiResponse(responseCode = "201", description = "Created"),
        @ApiResponse(responseCode = "400", description = "Validation error"),
        @ApiResponse(responseCode = "409", description = "Already exists")
    }
)
```

## Authentication

| Method | Use Case | Implementation |
|--------|----------|---------------|
| JWT Bearer | API clients | Spring Security + jjwt |
| OAuth2 | Third-party auth | Spring Security OAuth2 |
| Basic Auth | Simple / internal | Spring Security |
| API Key | Service-to-service | Custom filter |

### Security Configuration

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

## Rate Limiting

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 300 req | 1 min |
| Admin | 1000 req | 1 min |
