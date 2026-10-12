"""Create local Docker secrets without printing or replacing existing values."""
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / '.secrets'
folder.mkdir(mode=0o700, exist_ok=True)
for name in ['postgres_admin', 'db_password', 'redis_password', 'session_secret', 'birth_seed', 'admin_key', 'paystack_secret']:
    target = folder / name
    if target.exists():
        continue
    value = '' if name == 'paystack_secret' else secrets.token_hex(32)
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        stream.write(value)
env = root / '.env'
if not env.exists():
    env.write_text((root / '.env.example').read_text(encoding='utf-8'), encoding='utf-8')
print('Docker configuration and secrets are ready. Existing secrets were preserved.')
print('Keep .secrets private. Linux permissions: directory 700, files 644 for container reads.')
