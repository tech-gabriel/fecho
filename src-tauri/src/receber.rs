use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::compras::BANCO;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Abatimento {
    pub compra_id: i64,
    pub numero: i64,
    pub valor: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Deposito {
    pub terceiro_id: i64,
    pub valor_centavos: i64,
    pub data: String,
    pub competencia: String,
    pub abatimentos: Vec<Abatimento>,
}

pub async fn gravar_deposito(pool: &SqlitePool, deposito: &Deposito) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let id = sqlx::query(
        "INSERT INTO movimentos (terceiro_id, tipo, valor_centavos, data, competencia)
         VALUES (?, 'deposito', ?, ?, ?)",
    )
    .bind(deposito.terceiro_id)
    .bind(deposito.valor_centavos)
    .bind(&deposito.data)
    .bind(&deposito.competencia)
    .execute(&mut *tx)
    .await?
    .last_insert_rowid();

    for abatimento in &deposito.abatimentos {
        sqlx::query(
            "INSERT INTO abatimentos (movimento_id, compra_id, numero, valor_centavos)
             VALUES (?, ?, ?, ?)",
        )
        .bind(id)
        .bind(abatimento.compra_id)
        .bind(abatimento.numero)
        .bind(abatimento.valor)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(id)
}

#[tauri::command]
pub async fn registrar_deposito(
    bancos: State<'_, DbInstances>,
    deposito: Deposito,
) -> Result<i64, String> {
    let bancos = bancos.0.read().await;
    let Some(DbPool::Sqlite(pool)) = bancos.get(BANCO) else {
        return Err("Banco de dados não carregado".into());
    };
    gravar_deposito(pool, &deposito)
        .await
        .map_err(|erro| erro.to_string())
}

#[cfg(test)]
mod testes {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    fn banco() -> SqlitePool {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            for migration in crate::MIGRATIONS_SQL {
                sqlx::raw_sql(migration).execute(&pool).await.unwrap();
            }
            sqlx::raw_sql(
                "PRAGMA foreign_keys = ON;
                 INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Roxo', 28, 5, '#8B5CF6');
                 INSERT INTO terceiros (nome, cor) VALUES ('Ana', '#2563EB');
                 INSERT INTO compras (cartao_id, descricao, valor_total_centavos, num_parcelas, data_compra)
                   VALUES (1, 'Tênis', 200, 2, '2026-10-02');",
            )
            .execute(&pool)
            .await
            .unwrap();
            pool
        })
    }

    fn contar(pool: &SqlitePool, tabela: &str) -> i64 {
        tauri::async_runtime::block_on(async {
            sqlx::query_scalar(&format!("SELECT count(*) FROM {tabela}"))
                .fetch_one(pool)
                .await
                .unwrap()
        })
    }

    fn deposito(compra_id: i64) -> Deposito {
        Deposito {
            terceiro_id: 1,
            valor_centavos: 150,
            data: "2026-10-20".into(),
            competencia: "2026-10".into(),
            abatimentos: vec![
                Abatimento {
                    compra_id: 1,
                    numero: 1,
                    valor: 100,
                },
                Abatimento {
                    compra_id,
                    numero: 2,
                    valor: 50,
                },
            ],
        }
    }

    #[test]
    fn grava_o_deposito_com_os_abatimentos() {
        let pool = banco();

        tauri::async_runtime::block_on(gravar_deposito(&pool, &deposito(1))).unwrap();

        assert_eq!(contar(&pool, "movimentos"), 1);
        assert_eq!(contar(&pool, "abatimentos"), 2);
    }

    #[test]
    fn desfaz_tudo_se_um_abatimento_aponta_para_compra_inexistente() {
        let pool = banco();

        let resultado = tauri::async_runtime::block_on(gravar_deposito(&pool, &deposito(99)));

        assert!(resultado.is_err());
        assert_eq!(contar(&pool, "movimentos"), 0);
        assert_eq!(contar(&pool, "abatimentos"), 0);
    }
}
