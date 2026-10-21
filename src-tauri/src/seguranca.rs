use std::fs;
use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, Generate, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use pbkdf2::pbkdf2_hmac_array;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tauri::{AppHandle, Manager, Runtime};

pub const MARCA: &[u8] = b"FECHOENC1";
pub const BACKUP_CRIPTOGRAFADO: &str = "BACKUP_CRIPTOGRAFADO";
pub const SENHA_ERRADA: &str = "A senha do backup não confere.";
const ARQUIVO: &str = "seguranca.json";
const ITERACOES_DO_BACKUP: u32 = 600_000;
const ITERACOES_DO_PIN: u32 = 200_000;
const TAMANHO_DO_SAL: usize = 16;
const TAMANHO_DO_NONCE: usize = 12;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segredo {
    pub sal: Vec<u8>,
    pub valor: Vec<u8>,
    pub iteracoes: u32,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuracao {
    #[serde(default)]
    pub pin: Option<Segredo>,
    #[serde(default)]
    pub backup: Option<Segredo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Estado {
    pin_ativo: bool,
    backup_criptografado: bool,
    arquivo: String,
}

fn derivar(segredo: &[u8], sal: &[u8], iteracoes: u32) -> [u8; 32] {
    pbkdf2_hmac_array::<Sha256, 32>(segredo, sal, iteracoes)
}

fn novo_segredo(texto: &str, iteracoes: u32) -> Segredo {
    let sal = <[u8; TAMANHO_DO_SAL]>::generate().to_vec();
    let valor = derivar(texto.as_bytes(), &sal, iteracoes).to_vec();
    Segredo {
        sal,
        valor,
        iteracoes,
    }
}

pub fn hash_do_pin(pin: &str) -> Segredo {
    novo_segredo(pin, ITERACOES_DO_PIN)
}

pub fn pin_confere(segredo: &Segredo, pin: &str) -> bool {
    derivar(pin.as_bytes(), &segredo.sal, segredo.iteracoes).as_slice() == segredo.valor.as_slice()
}

pub fn chave_de_backup(senha: &str, iteracoes: u32) -> Segredo {
    novo_segredo(senha, iteracoes)
}

pub fn e_criptografado(bytes: &[u8]) -> bool {
    bytes.starts_with(MARCA)
}

pub fn criptografar(dados: &[u8], chave: &Segredo) -> Result<Vec<u8>, String> {
    let cifra = Aes256Gcm::new_from_slice(&chave.valor).map_err(|erro| erro.to_string())?;
    let nonce = Nonce::generate();
    let conteudo = cifra
        .encrypt(&nonce, dados)
        .map_err(|_| "Não foi possível criptografar o backup.".to_string())?;
    let mut saida = Vec::with_capacity(MARCA.len() + 32 + conteudo.len());
    saida.extend_from_slice(MARCA);
    saida.extend_from_slice(&chave.sal);
    saida.extend_from_slice(&chave.iteracoes.to_le_bytes());
    saida.extend_from_slice(&nonce);
    saida.extend_from_slice(&conteudo);
    Ok(saida)
}

pub fn descriptografar(bytes: &[u8], senha: &str) -> Result<Vec<u8>, String> {
    let resto = bytes.strip_prefix(MARCA).ok_or(SENHA_ERRADA)?;
    if resto.len() < TAMANHO_DO_SAL + 4 + TAMANHO_DO_NONCE {
        return Err(SENHA_ERRADA.into());
    }
    let (sal, resto) = resto.split_at(TAMANHO_DO_SAL);
    let (iteracoes, resto) = resto.split_at(4);
    let (nonce, conteudo) = resto.split_at(TAMANHO_DO_NONCE);
    let iteracoes = u32::from_le_bytes(iteracoes.try_into().map_err(|_| SENHA_ERRADA)?);
    let chave = derivar(senha.as_bytes(), sal, iteracoes);
    let cifra = Aes256Gcm::new_from_slice(&chave).map_err(|erro| erro.to_string())?;
    let nonce = Nonce::try_from(nonce).map_err(|_| SENHA_ERRADA)?;
    cifra
        .decrypt(&nonce, conteudo)
        .map_err(|_| SENHA_ERRADA.into())
}

pub fn caminho(pasta: &Path) -> PathBuf {
    pasta.join(ARQUIVO)
}

pub fn ler(pasta: &Path) -> Configuracao {
    fs::read(caminho(pasta))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn gravar(pasta: &Path, configuracao: &Configuracao) -> Result<(), String> {
    fs::create_dir_all(pasta).map_err(|erro| erro.to_string())?;
    let json = serde_json::to_vec_pretty(configuracao).map_err(|erro| erro.to_string())?;
    fs::write(caminho(pasta), json).map_err(|erro| erro.to_string())
}

pub fn pasta<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|erro| erro.to_string())
}

fn exigir_pin(pin: &str) -> Result<(), String> {
    if pin.len() == 4 && pin.bytes().all(|b| b.is_ascii_digit()) {
        Ok(())
    } else {
        Err("O PIN tem 4 dígitos.".into())
    }
}

#[tauri::command]
pub fn estado_da_seguranca<R: Runtime>(app: AppHandle<R>) -> Result<Estado, String> {
    let pasta = pasta(&app)?;
    let configuracao = ler(&pasta);
    Ok(Estado {
        pin_ativo: configuracao.pin.is_some(),
        backup_criptografado: configuracao.backup.is_some(),
        arquivo: caminho(&pasta).to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn definir_pin<R: Runtime>(app: AppHandle<R>, pin: String) -> Result<(), String> {
    exigir_pin(&pin)?;
    let pasta = pasta(&app)?;
    let mut configuracao = ler(&pasta);
    configuracao.pin = Some(hash_do_pin(&pin));
    gravar(&pasta, &configuracao)
}

#[tauri::command]
pub fn conferir_pin<R: Runtime>(app: AppHandle<R>, pin: String) -> Result<bool, String> {
    Ok(ler(&pasta(&app)?)
        .pin
        .is_some_and(|segredo| pin_confere(&segredo, &pin)))
}

#[tauri::command]
pub fn remover_pin<R: Runtime>(app: AppHandle<R>, pin: String) -> Result<bool, String> {
    let pasta = pasta(&app)?;
    let mut configuracao = ler(&pasta);
    if !configuracao
        .pin
        .as_ref()
        .is_some_and(|segredo| pin_confere(segredo, &pin))
    {
        return Ok(false);
    }
    configuracao.pin = None;
    gravar(&pasta, &configuracao)?;
    Ok(true)
}

#[tauri::command]
pub fn definir_senha_de_backup<R: Runtime>(
    app: AppHandle<R>,
    senha: Option<String>,
) -> Result<(), String> {
    let pasta = pasta(&app)?;
    let mut configuracao = ler(&pasta);
    configuracao.backup = match senha {
        Some(senha) if senha.chars().count() >= 8 => {
            Some(chave_de_backup(&senha, ITERACOES_DO_BACKUP))
        }
        Some(_) => return Err("Use pelo menos 8 caracteres.".into()),
        None => None,
    };
    gravar(&pasta, &configuracao)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn criptografa_e_descriptografa_com_a_senha_certa() {
        let chave = chave_de_backup("senha-longa", 1_000);
        let criptografado = criptografar(b"conteudo do banco", &chave).unwrap();

        assert!(e_criptografado(&criptografado));
        assert!(!e_criptografado(b"SQLite format 3"));
        assert_eq!(
            descriptografar(&criptografado, "senha-longa").unwrap(),
            b"conteudo do banco"
        );
        assert_eq!(
            descriptografar(&criptografado, "senha-errada").unwrap_err(),
            SENHA_ERRADA
        );
        assert_eq!(
            descriptografar(&criptografado[..20], "senha-longa").unwrap_err(),
            SENHA_ERRADA
        );
    }

    #[test]
    fn confere_o_pin_sem_guardar_o_pin() {
        let segredo = hash_do_pin("2580");

        assert!(pin_confere(&segredo, "2580"));
        assert!(!pin_confere(&segredo, "2581"));
        assert_ne!(segredo.valor, b"2580".to_vec());
        assert!(exigir_pin("12a4").is_err());
        assert!(exigir_pin("1234").is_ok());
    }

    #[test]
    fn grava_e_le_a_configuracao_e_sobrevive_a_arquivo_estragado() {
        let pasta = std::env::temp_dir().join(format!("fecho-seguranca-{}", std::process::id()));
        let _ = fs::remove_dir_all(&pasta);

        assert!(ler(&pasta).pin.is_none());
        let configuracao = Configuracao {
            pin: Some(hash_do_pin("2580")),
            backup: None,
        };
        gravar(&pasta, &configuracao).unwrap();
        assert!(pin_confere(ler(&pasta).pin.as_ref().unwrap(), "2580"));

        fs::write(caminho(&pasta), b"{estragado").unwrap();
        assert!(ler(&pasta).pin.is_none());
        let _ = fs::remove_dir_all(&pasta);
    }
}
