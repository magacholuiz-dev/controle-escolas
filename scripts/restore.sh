#!/bin/sh
# Restaura um backup. Uso: sh scripts/restore.sh backups/ARQUIVO.gz [banco-destino]
# Sem banco-destino, restaura no banco de origem, sobrescrevendo coleções com o mesmo nome (--drop).
set -e
ARQ="$1"; DESTINO="$2"
[ -f "$ARQ" ] || { echo "Arquivo não encontrado: $ARQ"; exit 1; }
ORIGEM="$(basename "$ARQ" | sed 's/_[0-9-]*_[0-9]*\.gz$//')"
DESTINO="${DESTINO:-$ORIGEM}"
docker exec -i controle-escolas-mongo mongorestore --quiet --archive --gzip --drop \
  --nsFrom "${ORIGEM}.*" --nsTo "${DESTINO}.*" < "$ARQ"
echo "Restaurado de $ARQ em $DESTINO"
