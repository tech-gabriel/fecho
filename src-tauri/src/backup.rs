use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, SqlitePool};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::compras::BANCO;
use crate::seguranca::{self, Segredo};

const ARQUIVO_DO_BANCO: &str = "fecho.db";
const RESTAURACAO_PENDENTE: &str = "fecho.db.restaurar";
const BACKUPS_MANTIDOS: usize = 10;
const NAO_E_BACKUP: &str = "Este arquivo não é um backup do Fechô.";
const MAIS_NOVO: &str = "Este backup é de uma versão mais nova do Fechô.";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Caminhos {
    banco: String,
    backups: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoDoBackup {
    compras: i64,
    versao: i64,
    modificado_em: u64,
}

fn pasta_do_banco<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|erro| erro.to_string())
}

fn pasta_de_backups<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let documentos = app.path().document_dir().map_err(|erro| erro.to_string())?;
    Ok(documentos.join("Fechô").join("Backups"))
}

async fn pool_aberto(bancos: &State<'_, DbInstances>) -> Result<SqlitePool, String> {
    let bancos = bancos.0.read().await;
    match bancos.get(BANCO) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("Banco de dados não carregado".into()),
    }
}

pub async fn copiar(pool: &SqlitePool, destino: &Path) -> Result<(), String> {
    if destino.exists() {
        fs::remove_file(destino).map_err(|erro| erro.to_string())?;
    }
    sqlx::query("VACUUM INTO ?")
        .bind(destino.to_string_lossy().to_string())
        .execute(pool)
        .await
        .map_err(|erro| erro.to_string())?;
    Ok(())
}

// Arquivo em claro só existe dentro da pasta privada do app e é apagado mesmo em erro.
struct Temporario(PathBuf);

impl Temporario {
    fn novo(pasta_privada: &Path) -> Result<Self, String> {
        fs::create_dir_all(pasta_privada).map_err(|erro| erro.to_string())?;
        Ok(Self(pasta_privada.join(format!(
            "temporario-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_or(0, |d| d.as_nanos())
        ))))
    }
}

impl Drop for Temporario {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

pub async fn copiar_protegido(
    pool: &SqlitePool,
    destino: &Path,
    chave: Option<&Segredo>,
    pasta_privada: &Path,
) -> Result<(), String> {
    let Some(chave) = chave else {
        return copiar(pool, destino).await;
    };
    let temporario = Temporario::novo(pasta_privada)?;
    copiar(pool, &temporario.0).await?;
    let bytes = fs::read(&temporario.0).map_err(|erro| erro.to_string())?;
    fs::write(destino, seguranca::criptografar(&bytes, chave)?).map_err(|erro| erro.to_string())
}

pub struct BackupAberto {
    pub caminho: PathBuf,
    _temporario: Option<Temporario>,
}

pub fn abrir(
    origem: &Path,
    senha: Option<&str>,
    pasta_privada: &Path,
) -> Result<BackupAberto, String> {
    let bytes = fs::read(origem).map_err(|_| NAO_E_BACKUP.to_string())?;
    if !seguranca::e_criptografado(&bytes) {
        return Ok(BackupAberto {
            caminho: origem.to_path_buf(),
            _temporario: None,
        });
    }
    let senha = senha.ok_or_else(|| seguranca::BACKUP_CRIPTOGRAFADO.to_string())?;
    let claro = seguranca::descriptografar(&bytes, senha)?;
    let temporario = Temporario::novo(pasta_privada)?;
    fs::write(&temporario.0, claro).map_err(|erro| erro.to_string())?;
    Ok(BackupAberto {
        caminho: temporario.0.clone(),
        _temporario: Some(temporario),
    })
}

fn modificado_em(caminho: &Path) -> u64 {
    fs::metadata(caminho)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(0))
}

fn chave_atual<R: Runtime>(app: &AppHandle<R>) -> Result<Option<Segredo>, String> {
    Ok(seguranca::ler(&seguranca::pasta(app)?).backup)
}

pub fn podar(pasta: &Path, manter: usize) -> std::io::Result<()> {
    let mut automaticos: Vec<PathBuf> = fs::read_dir(pasta)?
        .filter_map(|entrada| entrada.ok().map(|e| e.path()))
        .filter(|caminho| {
            caminho
                .file_name()
                .and_then(|nome| nome.to_str())
                .is_some_and(|nome| nome.starts_with("fecho-") && nome.ends_with(".db"))
        })
        .collect();
    automaticos.sort();
    let excesso = automaticos.len().saturating_sub(manter);
    for antigo in &automaticos[..excesso] {
        fs::remove_file(antigo)?;
    }
    Ok(())
}

pub async fn inspecionar(origem: &Path, versao_do_app: i64) -> Result<InfoDoBackup, String> {
    let mut conexao = SqliteConnectOptions::new()
        .filename(origem)
        .read_only(true)
        .connect()
        .await
        .map_err(|_| NAO_E_BACKUP.to_string())?;
    let versao: Option<i64> = sqlx::query_scalar("SELECT max(version) FROM _sqlx_migrations")
        .fetch_one(&mut conexao)
        .await
        .map_err(|_| NAO_E_BACKUP.to_string())?;
    let versao = versao.ok_or_else(|| NAO_E_BACKUP.to_string())?;
    if versao > versao_do_app {
        return Err(MAIS_NOVO.into());
    }
    let compras: i64 = sqlx::query_scalar("SELECT count(*) FROM compras WHERE deleted_at IS NULL")
        .fetch_one(&mut conexao)
        .await
        .map_err(|_| NAO_E_BACKUP.to_string())?;
    Ok(InfoDoBackup {
        compras,
        versao,
        modificado_em: modificado_em(origem),
    })
}

pub fn aplicar_restauracao_pendente(pasta_do_banco: &Path) -> std::io::Result<bool> {
    let pendente = pasta_do_banco.join(RESTAURACAO_PENDENTE);
    if !pendente.exists() {
        return Ok(false);
    }
    let diario = pasta_do_banco.join(format!("{ARQUIVO_DO_BANCO}-journal"));
    if diario.exists() {
        fs::remove_file(diario)?;
    }
    fs::rename(pendente, pasta_do_banco.join(ARQUIVO_DO_BANCO))?;
    Ok(true)
}

#[tauri::command]
pub fn caminhos_de_dados<R: Runtime>(app: AppHandle<R>) -> Result<Caminhos, String> {
    Ok(Caminhos {
        banco: pasta_do_banco(&app)?
            .join(ARQUIVO_DO_BANCO)
            .to_string_lossy()
            .to_string(),
        backups: pasta_de_backups(&app)?.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn exportar_backup<R: Runtime>(
    app: AppHandle<R>,
    bancos: State<'_, DbInstances>,
    destino: String,
) -> Result<(), String> {
    let chave = chave_atual(&app)?;
    copiar_protegido(
        &pool_aberto(&bancos).await?,
        Path::new(&destino),
        chave.as_ref(),
        &pasta_do_banco(&app)?,
    )
    .await
}

#[tauri::command]
pub async fn backup_automatico<R: Runtime>(
    app: AppHandle<R>,
    bancos: State<'_, DbInstances>,
    nome: String,
) -> Result<String, String> {
    let pasta = pasta_de_backups(&app)?;
    fs::create_dir_all(&pasta).map_err(|erro| erro.to_string())?;
    let destino = pasta.join(nome);
    let chave = chave_atual(&app)?;
    copiar_protegido(
        &pool_aberto(&bancos).await?,
        &destino,
        chave.as_ref(),
        &pasta_do_banco(&app)?,
    )
    .await?;
    podar(&pasta, BACKUPS_MANTIDOS).map_err(|erro| erro.to_string())?;
    Ok(destino.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn inspecionar_backup<R: Runtime>(
    app: AppHandle<R>,
    origem: String,
    senha: Option<String>,
) -> Result<InfoDoBackup, String> {
    let origem = Path::new(&origem);
    let aberto = abrir(origem, senha.as_deref(), &pasta_do_banco(&app)?)?;
    let mut info = inspecionar(&aberto.caminho, crate::versao_do_banco()).await?;
    info.modificado_em = modificado_em(origem);
    Ok(info)
}

#[tauri::command]
pub async fn restaurar_backup<R: Runtime>(
    app: AppHandle<R>,
    bancos: State<'_, DbInstances>,
    origem: String,
    nome: String,
    senha: Option<String>,
) -> Result<(), String> {
    let aberto = abrir(Path::new(&origem), senha.as_deref(), &pasta_do_banco(&app)?)?;
    inspecionar(&aberto.caminho, crate::versao_do_banco()).await?;
    let chave = chave_atual(&app)?;
    let backups = pasta_de_backups(&app)?;
    fs::create_dir_all(&backups).map_err(|erro| erro.to_string())?;
    copiar_protegido(
        &pool_aberto(&bancos).await?,
        &backups.join(format!("antes-de-restaurar-{nome}")),
        chave.as_ref(),
        &pasta_do_banco(&app)?,
    )
    .await?;
    fs::copy(
        &aberto.caminho,
        pasta_do_banco(&app)?.join(RESTAURACAO_PENDENTE),
    )
    .map_err(|erro| erro.to_string())?;
    drop(aberto);
    app.restart()
}

#[cfg(test)]
mod testes {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    fn pasta_temporaria(nome: &str) -> PathBuf {
        let pasta = std::env::temp_dir().join(format!(
            "fecho-teste-{nome}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&pasta).unwrap();
        pasta
    }

    // Banco em arquivo: com sqlite::memory: o VACUUM INTO herda o modo memória e não grava nada.
    fn banco_com_versao(versao: i64) -> SqlitePool {
        let arquivo = pasta_temporaria("origem").join("fecho.db");
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect_with(
                    SqliteConnectOptions::new()
                        .filename(&arquivo)
                        .create_if_missing(true),
                )
                .await
                .unwrap();
            for migration in crate::MIGRATIONS_SQL {
                sqlx::raw_sql(migration).execute(&pool).await.unwrap();
            }
            sqlx::raw_sql(&format!(
                "CREATE TABLE _sqlx_migrations (version BIGINT PRIMARY KEY);
                 INSERT INTO _sqlx_migrations VALUES ({versao});
                 INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Roxo', 28, 5, '#8B5CF6');
                 INSERT INTO compras (cartao_id, descricao, valor_total_centavos, num_parcelas, data_compra)
                   VALUES (1, 'Tênis', 100, 1, '2026-10-19'), (1, 'Livro', 100, 1, '2026-10-19');
                 UPDATE compras SET deleted_at = '2026-10-20' WHERE descricao = 'Livro';"
            ))
            .execute(&pool)
            .await
            .unwrap();
            pool
        })
    }

    #[test]
    fn copia_e_inspeciona_o_backup() {
        let pasta = pasta_temporaria("copia");
        let destino = pasta.join("backup.db");
        fs::write(&destino, "arquivo antigo").unwrap();

        tauri::async_runtime::block_on(copiar(&banco_com_versao(5), &destino)).unwrap();
        let info = tauri::async_runtime::block_on(inspecionar(&destino, 5)).unwrap();

        assert_eq!((info.compras, info.versao), (1, 5));
        assert!(info.modificado_em > 0);
    }

    #[test]
    fn criptografa_o_backup_e_so_abre_com_a_senha() {
        let pasta = pasta_temporaria("criptografado");
        let privada = pasta_temporaria("privada");
        let destino = pasta.join("backup.db");
        let chave = seguranca::chave_de_backup("senha-longa", 1_000);

        tauri::async_runtime::block_on(copiar_protegido(
            &banco_com_versao(5),
            &destino,
            Some(&chave),
            &privada,
        ))
        .unwrap();

        assert!(seguranca::e_criptografado(&fs::read(&destino).unwrap()));
        assert_eq!(fs::read_dir(&pasta).unwrap().count(), 1);
        assert_eq!(fs::read_dir(&privada).unwrap().count(), 0);
        assert_eq!(
            abrir(&destino, None, &privada).err().unwrap(),
            seguranca::BACKUP_CRIPTOGRAFADO
        );
        assert_eq!(
            abrir(&destino, Some("errada"), &privada).err().unwrap(),
            seguranca::SENHA_ERRADA
        );
        let aberto = abrir(&destino, Some("senha-longa"), &privada).unwrap();
        assert!(aberto.caminho.starts_with(&privada));
        let info = tauri::async_runtime::block_on(inspecionar(&aberto.caminho, 5)).unwrap();
        assert_eq!(info.compras, 1);
        let temporario = aberto.caminho.clone();
        drop(aberto);
        assert!(!temporario.exists());
    }

    #[test]
    fn copia_para_caminho_com_apostrofo() {
        let pasta = pasta_temporaria("apostrofo").join("pasta d'água");
        fs::create_dir_all(&pasta).unwrap();
        let destino = pasta.join("backup de d'Ávila.db");

        tauri::async_runtime::block_on(copiar(&banco_com_versao(5), &destino)).unwrap();

        assert!(destino.exists());
    }

    #[test]
    fn recusa_arquivo_estranho_e_backup_mais_novo() {
        let pasta = pasta_temporaria("recusa");
        let texto = pasta.join("notas.db");
        fs::write(&texto, "não sou um banco").unwrap();
        let novo = pasta.join("novo.db");
        tauri::async_runtime::block_on(copiar(&banco_com_versao(99), &novo)).unwrap();

        let estranho = tauri::async_runtime::block_on(inspecionar(&texto, 5));
        let mais_novo = tauri::async_runtime::block_on(inspecionar(&novo, 5));
        let inexistente = tauri::async_runtime::block_on(inspecionar(&pasta.join("nada.db"), 5));

        assert_eq!(estranho, Err(NAO_E_BACKUP.to_string()));
        assert_eq!(mais_novo, Err(MAIS_NOVO.to_string()));
        assert_eq!(inexistente, Err(NAO_E_BACKUP.to_string()));
    }

    #[test]
    fn poda_mantem_os_automaticos_mais_recentes() {
        let pasta = pasta_temporaria("poda");
        for dia in 1..=12 {
            fs::write(pasta.join(format!("fecho-2026-10-{dia:02}-080000.db")), "").unwrap();
        }
        fs::write(
            pasta.join("antes-de-restaurar-fecho-2026-01-01-000000.db"),
            "",
        )
        .unwrap();

        podar(&pasta, 10).unwrap();

        let mut restantes: Vec<String> = fs::read_dir(&pasta)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        restantes.sort();
        assert_eq!(restantes.len(), 11);
        assert_eq!(
            restantes[0],
            "antes-de-restaurar-fecho-2026-01-01-000000.db"
        );
        assert_eq!(restantes[1], "fecho-2026-10-03-080000.db");
    }

    #[test]
    fn aplica_a_restauracao_pendente_uma_vez() {
        let pasta = pasta_temporaria("restaura");
        fs::write(pasta.join(ARQUIVO_DO_BANCO), "velho").unwrap();
        fs::write(pasta.join(RESTAURACAO_PENDENTE), "novo").unwrap();

        assert!(aplicar_restauracao_pendente(&pasta).unwrap());
        assert!(!aplicar_restauracao_pendente(&pasta).unwrap());
        assert_eq!(
            fs::read_to_string(pasta.join(ARQUIVO_DO_BANCO)).unwrap(),
            "novo"
        );
    }
}
