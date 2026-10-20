mod cartoes;
mod compras;

use tauri_plugin_sql::{Migration, MigrationKind};

const MIGRATION_1: &str = include_str!("../../src/data/migrations/0001_cadastros_e_compras.sql");
const MIGRATION_2: &str = include_str!("../../src/data/migrations/0002_arquivar_e_categorias.sql");
const MIGRATION_3: &str = include_str!("../../src/data/migrations/0003_observacao.sql");

#[cfg(test)]
pub(crate) const MIGRATIONS_SQL: [&str; 3] = [MIGRATION_1, MIGRATION_2, MIGRATION_3];

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
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            cartoes::atualizar_cartao
        ])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Fechô");
}
