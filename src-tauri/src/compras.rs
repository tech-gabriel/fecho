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
    pub observacao: Option<String>,
    #[serde(default)]
    pub assinatura_id: Option<i64>,
    #[serde(default)]
    pub assinatura_mes: Option<String>,
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
    let compra_id = inserir_na_transacao(&mut tx, compra, rateios, parcelas).await?;
    tx.commit().await?;
    Ok(compra_id)
}

async fn inserir_na_transacao(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    compra: &Compra,
    rateios: &[Rateio],
    parcelas: &[Parcela],
) -> Result<i64, sqlx::Error> {
    let compra_id = sqlx::query(
        "INSERT INTO compras (cartao_id, descricao, categoria_id, valor_total_centavos,
           num_parcelas, data_compra, recorrente, observacao, assinatura_id, assinatura_mes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(compra.cartao_id)
    .bind(&compra.descricao)
    .bind(compra.categoria_id)
    .bind(compra.valor_total_centavos)
    .bind(compra.num_parcelas)
    .bind(&compra.data_compra)
    .bind(compra.recorrente)
    .bind(&compra.observacao)
    .bind(compra.assinatura_id)
    .bind(&compra.assinatura_mes)
    .execute(&mut **tx)
    .await?
    .last_insert_rowid();

    inserir_filhos(tx, compra_id, rateios, parcelas).await?;
    Ok(compra_id)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompraPreparada {
    pub compra: Compra,
    pub rateios: Vec<Rateio>,
    pub parcelas: Vec<Parcela>,
}

pub async fn importar(
    pool: &SqlitePool,
    compras: &[CompraPreparada],
) -> Result<Vec<i64>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let mut ids = Vec::with_capacity(compras.len());
    for item in compras {
        ids.push(inserir_na_transacao(&mut tx, &item.compra, &item.rateios, &item.parcelas).await?);
    }
    tx.commit().await?;
    Ok(ids)
}

#[tauri::command]
pub async fn importar_compras(
    bancos: State<'_, DbInstances>,
    compras: Vec<CompraPreparada>,
) -> Result<Vec<i64>, String> {
    let bancos = bancos.0.read().await;
    let Some(DbPool::Sqlite(pool)) = bancos.get(BANCO) else {
        return Err("Banco de dados não carregado".into());
    };
    importar(pool, &compras)
        .await
        .map_err(|erro| erro.to_string())
}

async fn inserir_filhos(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    compra_id: i64,
    rateios: &[Rateio],
    parcelas: &[Parcela],
) -> Result<(), sqlx::Error> {
    for rateio in rateios {
        sqlx::query("INSERT INTO rateios (compra_id, terceiro_id, percentual) VALUES (?, ?, ?)")
            .bind(compra_id)
            .bind(rateio.terceiro_id)
            .bind(rateio.percentual)
            .execute(&mut **tx)
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
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

pub async fn trocar_compra(
    pool: &SqlitePool,
    id: i64,
    compra: &Compra,
    rateios: &[Rateio],
    parcelas: &[Parcela],
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let alteradas = sqlx::query(
        "UPDATE compras SET cartao_id = ?, descricao = ?, categoria_id = ?, valor_total_centavos = ?,
           num_parcelas = ?, data_compra = ?, recorrente = ?, observacao = ?
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(compra.cartao_id)
    .bind(&compra.descricao)
    .bind(compra.categoria_id)
    .bind(compra.valor_total_centavos)
    .bind(compra.num_parcelas)
    .bind(&compra.data_compra)
    .bind(compra.recorrente)
    .bind(&compra.observacao)
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if alteradas == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query("DELETE FROM rateios WHERE compra_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM parcelas WHERE compra_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    inserir_filhos(&mut tx, id, rateios, parcelas).await?;
    tx.commit().await
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

#[tauri::command]
pub async fn substituir_compra(
    bancos: State<'_, DbInstances>,
    id: i64,
    compra: Compra,
    rateios: Vec<Rateio>,
    parcelas: Vec<Parcela>,
) -> Result<(), String> {
    let bancos = bancos.0.read().await;
    let Some(DbPool::Sqlite(pool)) = bancos.get(BANCO) else {
        return Err("Banco de dados não carregado".into());
    };
    trocar_compra(pool, id, &compra, &rateios, &parcelas)
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
            for migration in crate::MIGRATIONS_SQL {
                sqlx::raw_sql(migration).execute(&pool).await.unwrap();
            }
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
            observacao: Some("presente".into()),
            assinatura_id: None,
            assinatura_mes: None,
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
    fn recusa_a_mesma_assinatura_duas_vezes_no_mes() {
        let pool = banco();
        tauri::async_runtime::block_on(
            sqlx::query(
                "INSERT INTO assinaturas (nome, cartao_id, valor_centavos, dia, inicio)
                   VALUES ('Nuvem', 1, 2940, 25, '2026-10')",
            )
            .execute(&pool),
        )
        .unwrap();
        let cobranca = Compra {
            assinatura_id: Some(1),
            assinatura_mes: Some("2026-10".into()),
            ..compra()
        };

        tauri::async_runtime::block_on(inserir_compra(&pool, &cobranca, &[], &parcelas()))
            .unwrap();
        let repetida =
            tauri::async_runtime::block_on(inserir_compra(&pool, &cobranca, &[], &parcelas()));

        assert!(repetida.is_err());
        assert_eq!(contar(&pool, "compras"), 1);
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
    fn substitui_compra_rateios_e_parcelas() {
        let pool = banco();
        let rateios = [Rateio {
            terceiro_id: Some(1),
            percentual: 100,
        }];
        let id =
            tauri::async_runtime::block_on(inserir_compra(&pool, &compra(), &rateios, &parcelas()))
                .unwrap();
        let mut nova = compra();
        nova.descricao = "Tênis novo".into();

        tauri::async_runtime::block_on(trocar_compra(&pool, id, &nova, &[], &parcelas()[..2]))
            .unwrap();

        assert_eq!(contar(&pool, "rateios"), 0);
        assert_eq!(contar(&pool, "parcelas"), 2);
    }

    #[test]
    fn substituir_desfaz_tudo_em_erro_e_recusa_compra_inexistente() {
        let pool = banco();
        let id = tauri::async_runtime::block_on(inserir_compra(&pool, &compra(), &[], &parcelas()))
            .unwrap();
        let mut invalidas = parcelas();
        invalidas[0].numero = 99;

        let resultado =
            tauri::async_runtime::block_on(trocar_compra(&pool, id, &compra(), &[], &invalidas));
        let inexistente =
            tauri::async_runtime::block_on(trocar_compra(&pool, 42, &compra(), &[], &parcelas()));

        assert!(resultado.is_err());
        assert_eq!(contar(&pool, "parcelas"), 3);
        assert!(matches!(inexistente, Err(sqlx::Error::RowNotFound)));
    }

    #[test]
    fn importa_todas_as_compras_ou_nenhuma() {
        let pool = banco();
        let preparada = |numero_errado: bool| {
            let mut lista = parcelas();
            if numero_errado {
                lista[0].numero = 99;
            }
            CompraPreparada {
                compra: compra(),
                rateios: vec![],
                parcelas: lista,
            }
        };

        let ids =
            tauri::async_runtime::block_on(importar(&pool, &[preparada(false), preparada(false)]))
                .unwrap();
        let falha =
            tauri::async_runtime::block_on(importar(&pool, &[preparada(false), preparada(true)]));

        assert_eq!(ids.len(), 2);
        assert!(falha.is_err());
        assert_eq!(contar(&pool, "compras"), 2);
        assert_eq!(contar(&pool, "parcelas"), 6);
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
