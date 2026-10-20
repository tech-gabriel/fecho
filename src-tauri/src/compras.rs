use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

pub const BANCO: &str = "sqlite:fecho.db";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Compra {
    pub cartao_id: i64,
    pub descricao: String,
    pub categoria_id: Option<i64>,
    pub valor_total_centavos: i64,
    pub num_parcelas: i64,
    pub data_compra: String,
    pub recorrente: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rateio {
    pub terceiro_id: Option<i64>,
    pub percentual: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Parcela {
    pub numero: i64,
    pub competencia: String,
    pub valor_centavos: i64,
}

pub async fn inserir_compra(
    pool: &SqlitePool,
    compra: &Compra,
    rateios: &[Rateio],
    parcelas: &[Parcela],
) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let compra_id = sqlx::query(
        "INSERT INTO compras (cartao_id, descricao, categoria_id, valor_total_centavos,
           num_parcelas, data_compra, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(compra.cartao_id)
    .bind(&compra.descricao)
    .bind(compra.categoria_id)
    .bind(compra.valor_total_centavos)
    .bind(compra.num_parcelas)
    .bind(&compra.data_compra)
    .bind(compra.recorrente)
    .execute(&mut *tx)
    .await?
    .last_insert_rowid();

    for rateio in rateios {
        sqlx::query("INSERT INTO rateios (compra_id, terceiro_id, percentual) VALUES (?, ?, ?)")
            .bind(compra_id)
            .bind(rateio.terceiro_id)
            .bind(rateio.percentual)
            .execute(&mut *tx)
            .await?;
    }

    for parcela in parcelas {
        sqlx::query(
            "INSERT INTO parcelas (compra_id, numero, competencia, valor_centavos) VALUES (?, ?, ?, ?)",
        )
        .bind(compra_id)
        .bind(parcela.numero)
        .bind(&parcela.competencia)
        .bind(parcela.valor_centavos)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(compra_id)
}

#[tauri::command]
pub async fn salvar_compra(
    bancos: State<'_, DbInstances>,
    compra: Compra,
    rateios: Vec<Rateio>,
    parcelas: Vec<Parcela>,
) -> Result<i64, String> {
    let bancos = bancos.0.read().await;
    let Some(DbPool::Sqlite(pool)) = bancos.get(BANCO) else {
        return Err("Banco de dados não carregado".into());
    };
    inserir_compra(pool, &compra, &rateios, &parcelas)
        .await
        .map_err(|erro| erro.to_string())
}

#[cfg(test)]
mod testes {
    use super::*;
    use sqlx::{sqlite::SqlitePoolOptions, Row};

    fn banco() -> SqlitePool {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            sqlx::raw_sql(crate::MIGRATION_1)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query(
                "INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Roxo', 28, 5, '#8B5CF6')",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query("INSERT INTO terceiros (nome, cor) VALUES ('Ana', '#2563EB')")
                .execute(&pool)
                .await
                .unwrap();
            pool
        })
    }

    fn contar(pool: &SqlitePool, tabela: &str) -> i64 {
        tauri::async_runtime::block_on(async {
            sqlx::query(&format!("SELECT count(*) FROM {tabela}"))
                .fetch_one(pool)
                .await
                .unwrap()
                .get(0)
        })
    }

    fn compra() -> Compra {
        Compra {
            cartao_id: 1,
            descricao: "Tênis".into(),
            categoria_id: None,
            valor_total_centavos: 10_000,
            num_parcelas: 3,
            data_compra: "2026-10-19".into(),
            recorrente: false,
        }
    }

    fn parcelas() -> Vec<Parcela> {
        [
            (1, "2026-10", 3334),
            (2, "2026-11", 3333),
            (3, "2026-12", 3333),
        ]
        .into_iter()
        .map(|(numero, competencia, valor_centavos)| Parcela {
            numero,
            competencia: competencia.into(),
            valor_centavos,
        })
        .collect()
    }

    #[test]
    fn grava_compra_rateios_e_parcelas() {
        let pool = banco();
        let rateios = [
            Rateio {
                terceiro_id: None,
                percentual: 50,
            },
            Rateio {
                terceiro_id: Some(1),
                percentual: 50,
            },
        ];

        let id =
            tauri::async_runtime::block_on(inserir_compra(&pool, &compra(), &rateios, &parcelas()))
                .unwrap();

        assert_eq!(id, 1);
        assert_eq!(contar(&pool, "compras"), 1);
        assert_eq!(contar(&pool, "rateios"), 2);
        assert_eq!(contar(&pool, "parcelas"), 3);
    }

    #[test]
    fn desfaz_tudo_quando_uma_parcela_e_recusada() {
        let pool = banco();
        let mut invalidas = parcelas();
        invalidas[2].numero = 99;

        let resultado =
            tauri::async_runtime::block_on(inserir_compra(&pool, &compra(), &[], &invalidas));

        assert!(resultado.is_err());
        assert_eq!(contar(&pool, "compras"), 0);
        assert_eq!(contar(&pool, "parcelas"), 0);
    }

    #[test]
    fn desfaz_tudo_quando_o_rateio_aponta_para_terceiro_inexistente() {
        let pool = banco();
        let rateios = [Rateio {
            terceiro_id: Some(99),
            percentual: 100,
        }];

        let resultado =
            tauri::async_runtime::block_on(inserir_compra(&pool, &compra(), &rateios, &parcelas()));

        assert!(resultado.is_err());
        assert_eq!(contar(&pool, "compras"), 0);
    }

    #[test]
    fn numero_inteiro_enviado_como_f64_volta_inteiro() {
        let pool = banco();
        let (valor, tipo): (i64, String) = tauri::async_runtime::block_on(async {
            sqlx::query("UPDATE cartoes SET limite_centavos = ? WHERE id = 1")
                .bind(1050.0_f64)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query_as(
                "SELECT limite_centavos, typeof(limite_centavos) FROM cartoes WHERE id = 1",
            )
            .fetch_one(&pool)
            .await
            .unwrap()
        });

        assert_eq!((valor, tipo.as_str()), (1050, "integer"));
    }
}
