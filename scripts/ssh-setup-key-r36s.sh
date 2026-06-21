#!/usr/bin/env bash
# ssh-setup-key-r36s.sh — instala sua CHAVE PÚBLICA no R36S p/ login SEM senha.
# Pede a senha UMA vez; depois ssh-r36s.sh / deploy-r36s.sh ficam passwordless.
# Também salva a chave em board/r36s/authorized_keys p/ o build manter o acesso
# após reflash (arquivo NÃO versionado).
#
# Uso:  scripts/ssh-setup-key-r36s.sh [ip|host]   (default r36s-cyberdeck.local)
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SELF/.." && pwd)"
HOST="${1:-r36s-cyberdeck.local}"
OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=8"

# acha uma chave pública; gera ed25519 se não houver nenhuma
PUB=""
for k in id_ed25519 id_ecdsa id_rsa; do [ -f "$HOME/.ssh/$k.pub" ] && { PUB="$HOME/.ssh/$k.pub"; break; }; done
if [ -z "$PUB" ]; then
  echo "[key] nenhuma chave em ~/.ssh — gerando ed25519 (sem passphrase)"
  ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519" >/dev/null
  PUB="$HOME/.ssh/id_ed25519.pub"
fi
echo "[key] usando $PUB"

# instala no aparelho (pede senha 1x). ssh-copy-id cuida de perms/dedup.
if command -v ssh-copy-id >/dev/null 2>&1; then
  ssh-copy-id $OPTS -i "$PUB" "root@$HOST"
else
  KEY="$(cat "$PUB")"
  ssh $OPTS "root@$HOST" "mkdir -p /root/.ssh && chmod 700 /root/.ssh && \
    touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys && \
    grep -qxF '$KEY' /root/.ssh/authorized_keys || echo '$KEY' >> /root/.ssh/authorized_keys"
fi

# guarda p/ o build (passa a ir em toda imagem nova). É chave PÚBLICA, mas mantemos
# fora do git por ser específica do usuário (ver .gitignore).
mkdir -p "$REPO/board/r36s"
touch "$REPO/board/r36s/authorized_keys"
grep -qxF "$(cat "$PUB")" "$REPO/board/r36s/authorized_keys" || cat "$PUB" >> "$REPO/board/r36s/authorized_keys"

echo "[key] OK — agora ssh/deploy sem senha. Salvo em board/r36s/authorized_keys p/ o build."
echo "[key] teste:  scripts/ssh-r36s.sh $HOST true && echo SEM-SENHA"
