FROM python:3.10-slim

WORKDIR /app

# Ensure we don't write pyc files and keep python logging unbuffered
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose the API port
EXPOSE 8000

# Start Uvicorn with proxy headers support for correct HTTPS redirects
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
