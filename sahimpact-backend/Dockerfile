FROM python:3.10-slim@sha256:4fb0be7eb65e89547d2f34731ed58c1f964dc75d311910ad54203e87877ce5f8

WORKDIR /app

# Ensure we don't write pyc files and keep python logging unbuffered
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create a non-root user and group
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY . .

# Ensure data directory exists for SQLite (if still used) and configure permissions
RUN mkdir -p /app/data /app/uploads && \
    chown -R appuser:appgroup /app && \
    chmod -R 750 /app && \
    chmod -R 770 /app/data /app/uploads

# Switch to non-root user
USER appuser

# Expose the API port
EXPOSE 8000

# Start Uvicorn with proxy headers support for correct HTTPS redirects
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
