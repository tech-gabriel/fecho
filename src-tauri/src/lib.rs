mod backup;
mod cartoes;
mod compras;
mod receber;
mod seguranca;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

const MIGRATION_1: &str = include_str!("../../src/data/migrations/0001_cadastros_e_compras.sql");
const MIGRATION_2: &str = include_str!("../../src/data/migrations/0002_arquivar_e_categorias.sql");
const MIGRATION_3: &str = include_str!("../../src/data/migrations/0003_observacao.sql");
const MIGRATION_4: &str = include_str!("../../src/data/migrations/0004_faturas.sql");
const MIGRATION_5: &str =
    include_str!("../../src/data/migrations/0005_receitas_e_preferencias.sql");
const MIGRATION_6: &str = include_str!("../../src/data/migrations/0006_movimentos.sql");
const MIGRATION_7: &str = include_str!("../../src/data/migrations/0007_assinaturas.sql");
const MIGRATION_8: &str = include_str!("../../src/data/migrations/0008_emprestimos.sql");
const MIGRATION_9: &str = include_str!("../../src/data/migrations/0009_economias.sql");
const MIGRATION_10: &str = include_str!("../../src/data/migrations/0010_fechamento.sql");

#[cfg(test)]
pub(crate) const MIGRATIONS_SQL: [&str; 10] = [
    MIGRATION_1,
    MIGRATION_2,
    MIGRATION_3,
    MIGRATION_4,
    MIGRATION_5,
    MIGRATION_6,
    MIGRATION_7,
    MIGRATION_8,
    MIGRATION_9,
    MIGRATION_10,
];

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "cadastros_e_compras",
            sql: MIGRATION_1,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "arquivar_e_categorias",
            sql: MIGRATION_2,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "observacao",
            sql: MIGRATION_3,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "faturas",
            sql: MIGRATION_4,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "receitas_e_preferencias",
            sql: MIGRATION_5,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "movimentos",
            sql: MIGRATION_6,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "assinaturas",
            sql: MIGRATION_7,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "emprestimos",
            sql: MIGRATION_8,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "economias",
            sql: MIGRATION_9,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "fechamento",
            sql: MIGRATION_10,
            kind: MigrationKind::Up,
        },
    ]
}

pub(crate) fn versao_do_banco() -> i64 {
    i64::try_from(migrations().len()).unwrap_or(i64::MAX)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            backup::aplicar_restauracao_pendente(&app.path().app_config_dir()?)?;
            Ok(())
        })
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(compras::BANCO, migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            compras::salvar_compra,
            compras::importar_compras,
            compras::substituir_compra,
            cartoes::atualizar_cartao,
            receber::registrar_deposito,
            backup::caminhos_de_dados,
            backup::exportar_backup,
            backup::salvar_planilha,
            backup::backup_automatico,
            backup::inspecionar_backup,
            backup::restaurar_backup,
            seguranca::estado_da_seguranca,
            seguranca::definir_pin,
            seguranca::conferir_pin,
            seguranca::remover_pin,
            seguranca::definir_senha_de_backup
        ])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Fechô");
}
