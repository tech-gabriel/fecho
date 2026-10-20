use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, SqlitePool};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::compras::BANCO;

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
    let modificado_em = fs::metadata(origem)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(0));
    Ok(InfoDoBackup {
        compras,
        versao,
        modificado_em,
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
pub async fn exportar_backup(
    bancos: State<'_, DbInstances>,
    destino: String,
) -> Result<(), String> {
    copiar(&pool_aberto(&bancos).await?, Path::new(&destino)).await
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
    copiar(&pool_aberto(&bancos).await?, &destino).await?;
    podar(&pasta, BACKUPS_MANTIDOS).map_err(|erro| erro.to_string())?;
    Ok(destino.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn inspecionar_backup(origem: String) -> Result<InfoDoBackup, String> {
    inspecionar(Path::new(&origem), crate::versao_do_banco()).await
}

#[tauri::command]
pub async fn restaurar_backup<R: Runtime>(
    app: AppHandle<R>,
    bancos: State<'_, DbInstances>,
    origem: String,
    nome: String,
) -> Result<(), String> {
    let origem = Path::new(&origem);
    inspecionar(origem, crate::versao_do_banco()).await?;
    let backups = pasta_de_backups(&app)?;
    fs::create_dir_all(&backups).map_err(|erro| erro.to_string())?;
    copiar(
        &pool_aberto(&bancos).await?,
        &backups.join(format!("antes-de-restaurar-{nome}")),
    )
    .await?;
    fs::copy(origem, pasta_do_banco(&app)?.join(RESTAURACAO_PENDENTE))
        .map_err(|erro| erro.to_string())?;
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

    fn banco_com_versao(versao: i64) -> SqlitePool {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
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
