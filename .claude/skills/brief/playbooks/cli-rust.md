# Playbook: cli-rust

## Targets obligatorios
- **Why Rust** (vs Node/Go): binario pequeno, startup instantaneo, zero-dep en target.
- **Cross-compilation**: `cargo-dist`, `cross`, `cargo-zigbuild`. Cobertura de targets (x86_64 + aarch64 macOS/Linux/Windows).
- **Distribution**: Homebrew formula (macOS), Scoop/winget (Windows), AUR (Arch), apt/dnf si deb/rpm.
- **Release automation**: cargo-dist + GitHub Actions + Releases.
- **crates.io publish**: verificar nombre disponible, MSRV (Minimum Supported Rust Version).

## Targets opcionales
- **Shell completions** generados via clap `clap_complete`.
- **Man pages** generados via `clap_mangen`.
- **Auto-update** con `self_update` crate (cuidado con security implications).

## Busquedas sugeridas
- "cargo-dist tutorial 2026"
- "clap v4 derive patterns"
- "Rust CLI distribution Homebrew Scoop"

## Fuentes primarias
- https://opensource.axo.dev/cargo-dist/
- https://docs.rs/clap/latest/clap/
- https://rust-cli.github.io/book/

## Riesgos a investigar activamente
- **Build time**: Rust compila lento en CI — cache `~/.cargo` y `target/`.
- **Binary size**: default binaries pueden ser grandes; `strip`, LTO, codegen-units=1 ayudan.
- **Windows quirks**: line endings (LF vs CRLF), path separators, Unicode — testear real.
