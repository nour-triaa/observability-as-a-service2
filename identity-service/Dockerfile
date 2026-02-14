# Étape 1 : Java 17 léger
FROM eclipse-temurin:17-jdk-alpine

# Dossier de travail
WORKDIR /app

# Copier le JAR construit depuis Maven
COPY target/identity-service-0.0.1-SNAPSHOT.jar app.jar

# Expose le port du microservice
EXPOSE 8080

# Lancer le microservice
ENTRYPOINT ["java", "-jar", "app.jar"]

