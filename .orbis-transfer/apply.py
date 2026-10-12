from pathlib import Path
import base64, lzma, hashlib, subprocess
encoded = ''.join(Path(f'.orbis-transfer/part{i}').read_text().strip() for i in range(1, 5))
patch = lzma.decompress(base64.b64decode(encoded, validate=True))
assert hashlib.sha256(patch).hexdigest() == '428f10a83153eceb149ad3d5bd9f132b78955abe51d963ef3f0037cec52350d3', 'Patch checksum mismatch'
Path('/tmp/orbis-completion.patch').write_bytes(patch)
subprocess.run(['git', 'apply', '--check', '/tmp/orbis-completion.patch'], check=True)
subprocess.run(['git', 'apply', '--index', '/tmp/orbis-completion.patch'], check=True)
print('Verified and applied original M0-M4 implementation patch.')
