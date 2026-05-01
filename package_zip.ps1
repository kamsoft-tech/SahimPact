$zipFile = "iyi_pl_deploy.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile }

$stageDir = "stage_deploy"
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Path $stageDir

# Backend
New-Item -ItemType Directory -Path "$stageDir\sahimpact-backend"
Get-ChildItem -Path "sahimpact-backend" -Exclude "venv","__pycache__",".git" | Copy-Item -Destination "$stageDir\sahimpact-backend" -Recurse

# Frontend
New-Item -ItemType Directory -Path "$stageDir\sahimpact-frontend"
Get-ChildItem -Path "sahimpact-frontend" -Exclude "node_modules",".git","dist",".next" | Copy-Item -Destination "$stageDir\sahimpact-frontend" -Recurse

# Root files
Copy-Item "docker-compose.yml" "$stageDir\"
Copy-Item "deploy.sh" "$stageDir\"

Compress-Archive -Path "$stageDir\*" -DestinationPath $zipFile
Remove-Item -Recurse -Force $stageDir
Write-Host "✅ Created $zipFile"
