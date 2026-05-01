#!/bin/bash

# Configuration
PROJECT_NAME="partnersystem"
# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
DEPLOY_DIR="$SCRIPT_DIR/app"
ZIP_FILE="$SCRIPT_DIR/iyi_pl_deploy.zip"

echo "🚀 Starting Production Deployment..."

# 1. Check for dependencies
if ! command -v unzip &> /dev/null; then
    echo "❌ Error: 'unzip' is not installed on this server. Please install it (e.g., apt install unzip)."
    exit 1
fi

DOCKER_COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    else
        echo "❌ Error: Docker Compose is not installed."
        exit 1
    fi
fi

# 2. Create directory if not exists
mkdir -p $DEPLOY_DIR

# 3. Extract the new code
if [ -f "$ZIP_FILE" ]; then
    echo "📦 Extracting $ZIP_FILE..."
    unzip -o $ZIP_FILE -d $DEPLOY_DIR
    rm $ZIP_FILE
else
    echo "❌ Error: $ZIP_FILE not found! Please upload the updated zip to /root/ first."
    exit 1
fi

cd $DEPLOY_DIR

# 4. Handle .env file (Copy it into the deploy dir if it's in the parent)
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "📄 Syncing .env file..."
    cp "$SCRIPT_DIR/.env" "$DEPLOY_DIR/.env"
fi

# 4. Deploy with Docker Compose
echo "🛠️ Building and starting containers with project prefix: $PROJECT_NAME..."
$DOCKER_COMPOSE_CMD -p $PROJECT_NAME down --remove-orphans
$DOCKER_COMPOSE_CMD -p $PROJECT_NAME up -d --build

# 5. Cleanup
echo "🧹 Cleaning up old Docker images and builders..."
docker image prune -f
docker builder prune -f

echo "✅ Deployment Successful!"
echo "------------------------------------------------"
echo "Frontend: http://localhost:9090"
echo "Backend:  http://localhost:9000"
echo "------------------------------------------------"
echo "Next steps:"
echo "1. Verify containers are running: $DOCKER_COMPOSE_CMD -p $PROJECT_NAME ps"
echo "2. Setup your Reverse Proxy in NGINX GUI to point to port 9090."
