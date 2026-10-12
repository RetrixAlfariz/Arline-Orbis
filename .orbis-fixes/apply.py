from pathlib import Path
import base64,lzma,hashlib,subprocess
patch=lzma.decompress(base64.b64decode(Path('.orbis-fixes/patch.b64').read_bytes(),validate=True))
assert hashlib.sha256(patch).hexdigest()=='4ea96216f14e5e0db238003a83672b154c1220cb40dfe821942eb966626dba72','Patch checksum mismatch'
Path('/tmp/orbis-quality.patch').write_bytes(patch)
subprocess.run(['git','apply','--check','/tmp/orbis-quality.patch'],check=True)
subprocess.run(['git','apply','--index','/tmp/orbis-quality.patch'],check=True)
