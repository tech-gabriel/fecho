use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::compras::BANCO;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cartao {
    pub nome: String,
    pub dia_fechamento: i64,
    pub dia_vencimento: i64,
    pub limite_centavos: i64,
    pub cor: String,
    pub ativo: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParcelaMovida {
    pub compra_id: i64,
    pub numero: i64,
    pub competencia: String,
}

pub async fn gravar_cartao(
    pool: &SqlitePool,
    id: i64,
    cartao: &Cartao,
    parcelas: &[ParcelaMovida],
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let alterados = sqlx::query(
        "UPDATE cartoes SET nome = ?, dia_fechamento = ?, dia_vencimento = ?, limite_centavos = ?,
           cor = ?, ativo = ? WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&cartao.nome)
    .bind(cartao.dia_fechamento)
    .bind(cartao.dia_vencimento)
    .bind(cartao.limite_centavos)
    .bind(&cartao.cor)
    .bind(cartao.ativo)
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if alterados == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    for parcela in parcelas {
        let movidas = sqlx::query(
            "UPDATE parcelas SET competencia = ? WHERE compra_id = ? AND numero = ?
               AND compra_id IN (SELECT id FROM compras WHERE cartao_id = ?)",
        )
        .bind(&parcela.competencia)
        .bind(parcela.compra_id)
        .bind(parcela.numero)
        .bind(id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if movidas == 0 {
            return Err(sqlx::Error::RowNotFound);
        }
    }

    tx.commit().await
}

#[tauri::command]
pub async fn atualizar_cartao(
    bancos: State<'_, DbInstances>,
    id: i64,
    cartao: Cartao,
    parcelas: Vec<ParcelaMovida>,
) -> Result<(), String> {
    let bancos = bancos.0.read().await;
    let Some(DbPool::Sqlite(pool)) = bancos.get(BANCO) else {
        return Err("Banco de dados não carregado".into());
    };
    gravar_cartao(pool, id, &cartao, &parcelas)
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
            for migration in [crate::MIGRATION_1, crate::MIGRATION_2] {
                sqlx::raw_sql(migration).execute(&pool).await.unwrap();
            }
            sqlx::raw_sql(
                "INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Roxo', 28, 5, '#8B5CF6');
                 INSERT INTO compras (cartao_id, descricao, valor_total_centavos, num_parcelas, data_compra)
                   VALUES (1, 'Tênis', 200, 2, '2026-10-26');
                 INSERT INTO parcelas (compra_id, numero, competencia, valor_centavos)
                   VALUES (1, 1, '2026-10', 100), (1, 2, '2026-11', 100);",
            )
            .execute(&pool)
            .await
            .unwrap();
            pool
        })
    }

    fn consultar(pool: &SqlitePool, sql: &str) -> String {
        tauri::async_runtime::block_on(async {
            sqlx::query_scalar::<_, String>(sql)
                .fetch_one(pool)
                .await
                .unwrap()
        })
    }

    fn roxo(dia_fechamento: i64) -> Cartao {
        Cartao {
            nome: "Roxo".into(),
            dia_fechamento,
            dia_vencimento: 5,
            limite_centavos: 0,
            cor: "#8B5CF6".into(),
            ativo: true,
        }
    }

    fn mover(numero: i64, competencia: &str) -> ParcelaMovida {
        ParcelaMovida {
            compra_id: 1,
            numero,
            competencia: competencia.into(),
        }
    }

    const COMPETENCIAS: &str = "SELECT group_concat(competencia) FROM parcelas ORDER BY numero";
    const FECHAMENTO: &str = "SELECT CAST(dia_fechamento AS TEXT) FROM cartoes";

    #[test]
    fn grava_o_cartao_e_move_as_parcelas() {
        let pool = banco();
        let parcelas = [mover(1, "2026-11"), mover(2, "2026-12")];

        tauri::async_runtime::block_on(gravar_cartao(&pool, 1, &roxo(25), &parcelas)).unwrap();

        assert_eq!(consultar(&pool, FECHAMENTO), "25");
        assert_eq!(consultar(&pool, COMPETENCIAS), "2026-11,2026-12");
    }

    #[test]
    fn desfaz_tudo_quando_uma_parcela_nao_existe() {
        let pool = banco();
        let parcelas = [mover(1, "2026-11"), mover(9, "2027-01")];

        let resultado =
            tauri::async_runtime::block_on(gravar_cartao(&pool, 1, &roxo(25), &parcelas));

        assert!(resultado.is_err());
        assert_eq!(consultar(&pool, FECHAMENTO), "28");
        assert_eq!(consultar(&pool, COMPETENCIAS), "2026-10,2026-11");
    }

    #[test]
    fn recusa_cartao_inexistente() {
        let pool = banco();

        let resultado = tauri::async_runtime::block_on(gravar_cartao(&pool, 9, &roxo(25), &[]));

        assert!(matches!(resultado, Err(sqlx::Error::RowNotFound)));
    }
}
