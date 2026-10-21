import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const semver = /^(\d+)\.(\d+)\.(\d+)$/;

export function proximaVersao(atual, pedido) {
  const [, maior, menor, correcao] = semver.exec(atual).map(Number);
  const proxima =
    {
      major: `${maior + 1}.0.0`,
      minor: `${maior}.${menor + 1}.0`,
      patch: `${maior}.${menor}.${correcao + 1}`,
    }[pedido] ?? pedido;

  if (!semver.test(proxima)) throw new Error(`Versão inválida: ${pedido}`);
  const comparar = (v) => semver.exec(v).slice(1).map(Number);
  const [a, b] = [comparar(proxima), comparar(atual)];
  const maiorQueAtual = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  if (maiorQueAtual <= 0) throw new Error(`${proxima} não é maior que ${atual}`);
  return proxima;
}

export function comVersaoCargo(conteudo, versao) {
  return conteudo.replace(/(name = "fecho"\r?\nversion = ")[^"]+"/, `$1${versao}"`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain')) throw new Error('Há mudanças não commitadas.');

  const pacote = JSON.parse(readFileSync('package.json', 'utf8'));
  const versao = proximaVersao(pacote.version, process.argv[2] ?? 'patch');

  pacote.version = versao;
  writeFileSync('package.json', `${JSON.stringify(pacote, null, 2)}\n`);

  const tauriConf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  tauriConf.version = versao;
  writeFileSync('src-tauri/tauri.conf.json', `${JSON.stringify(tauriConf, null, 2)}\n`);

  for (const arquivo of ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']) {
    writeFileSync(arquivo, comVersaoCargo(readFileSync(arquivo, 'utf8'), versao));
  }

  git(
    'add',
    'package.json',
    'src-tauri/tauri.conf.json',
    'src-tauri/Cargo.toml',
    'src-tauri/Cargo.lock',
  );
  git('commit', '-m', `chore: lança v${versao}`);
  // A tag só nasce na main: o squash da develop troca o commit desta branch.
  console.log(
    [
      `Versão ${versao} commitada. Depois do PR e das promoções até a main:`,
      `  git fetch origin && git tag -a v${versao} -m v${versao} origin/main`,
      `  git push origin v${versao}`,
    ].join('\n'),
  );
}
