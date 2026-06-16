# ── Build stage: compile the Spring Boot fat jar inside the image ─────────────
# Using the maven image (not ./mvnw) because .dockerignore excludes the wrapper
# jar. Deps are cached in their own layer so only a pom.xml change re-downloads.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# ── Runtime stage: slim JRE running just the jar ──────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Heap auto-sizes to whatever 512 MB free box this lands on (Render / Cloud Run)
# via MaxRAMPercentage — no fixed -Xmx to retune per host. Serial GC suits 1 cpu.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=55.0 -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
