FROM python:3.11-slim
 
WORKDIR /app
 
# Dépendances système minimales
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*
 
# Dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
 
# Code applicatif
COPY . .
 
# Port exposé
EXPOSE 5000
 
# Gunicorn : 2 workers, timeout 120s pour les appels ML
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "main:app"]
 
