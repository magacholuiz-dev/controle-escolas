#!/bin/sh
# Gera backups/AAAA-MM-DD_HHMMSS.gz do banco (padrão: controle-escolas) usando o Mongo do Docker.
# Uso: npm run backup            (ou: DB=controle-escolas-demo npm run backup)
set -e
DB="${DB:-controle-escolas}"
mkdir -p backups
ARQ="backups/${DB}_$(date +%Y-%m-%d_%H%M%S).gz"
docker exec controle-escolas-mongo mongodump --quiet --archive --gzip --db "$DB" > "$ARQ"
echo "Backup salvo em $ARQ ($(du -h "$ARQ" | cut -f1))"
