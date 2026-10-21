const VK_F: u32 = 0x46;
const VK_R: u32 = 0x52;
const VK_C: u32 = 0x43;
const VK_ESQUERDA: u32 = 0x25;

// O WebView2 trata estas teclas antes do JavaScript (procurar, recarregar, inspecionar e voltar),
// e o Fechô usa cada uma como atalho próprio.
pub fn tecla_do_app(tecla: u32, ctrl: bool, shift: bool, alt: bool) -> bool {
    match (tecla, ctrl, shift, alt) {
        (VK_F | VK_R, true, false, false) => true,
        (VK_C, true, true, false) => true,
        (VK_ESQUERDA, false, false, true) => true,
        _ => false,
    }
}

#[cfg(windows)]
pub fn entregar_ao_app<R: tauri::Runtime>(janela: &tauri::WebviewWindow<R>) -> tauri::Result<()> {
    use webview2_com::AcceleratorKeyPressedEventHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2AcceleratorKeyPressedEventArgs2;
    use windows::core::Interface;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL, VK_MENU, VK_SHIFT};

    janela.with_webview(|webview| {
        let pressionada = |tecla: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY| unsafe {
            GetKeyState(i32::from(tecla.0)) < 0
        };
        let tratador = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            let mut tecla = 0u32;
            unsafe { args.VirtualKey(&mut tecla)? };
            if tecla_do_app(
                tecla,
                pressionada(VK_CONTROL),
                pressionada(VK_SHIFT),
                pressionada(VK_MENU),
            ) {
                unsafe {
                    args.cast::<ICoreWebView2AcceleratorKeyPressedEventArgs2>()?
                        .SetIsBrowserAcceleratorKeyEnabled(false)?;
                }
            }
            Ok(())
        }));
        let mut token = 0i64;
        unsafe {
            let _ = webview
                .controller()
                .add_AcceleratorKeyPressed(&tratador, &mut token);
        }
    })
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn so_tira_do_navegador_as_teclas_que_o_fecho_usa() {
        assert!(tecla_do_app(VK_F, true, false, false));
        assert!(tecla_do_app(VK_R, true, false, false));
        assert!(tecla_do_app(VK_C, true, true, false));
        assert!(tecla_do_app(VK_ESQUERDA, false, false, true));

        assert!(!tecla_do_app(0x50, true, false, false));
        assert!(!tecla_do_app(0xBB, true, false, false));
        assert!(!tecla_do_app(0x74, false, false, false));
        assert!(!tecla_do_app(VK_R, true, true, false));
        assert!(!tecla_do_app(VK_C, true, false, false));
    }
}
